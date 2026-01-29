"""Storage tree service for building hierarchical storage path tree."""

import uuid
from collections import defaultdict

from sqlmodel import Session, func, select

from app.models import MinIOInstance, Sample, SampleStatus, StorageTreeNode


def build_storage_tree(session: Session, owner_id: uuid.UUID) -> list[StorageTreeNode]:
    """Build a hierarchical tree of storage paths.

    Structure: MinIO Instance > Bucket > Folder hierarchy

    Args:
        session: Database session
        owner_id: Owner user ID

    Returns:
        List of StorageTreeNode representing the tree
    """
    # Get all active samples with their storage info
    query = (
        select(
            Sample.minio_instance_id,
            Sample.bucket,
            Sample.object_key,
        )
        .where(Sample.owner_id == owner_id)
        .where(Sample.status == SampleStatus.active)
    )
    results = session.exec(query).all()

    if not results:
        return []

    # Get MinIO instance names
    instance_ids = set(r[0] for r in results)
    instances = session.exec(
        select(MinIOInstance).where(MinIOInstance.id.in_(instance_ids))
    ).all()
    instance_map = {inst.id: inst.name for inst in instances}

    # Build tree structure
    # Structure: {instance_id: {bucket: {folder_path: count}}}
    tree_data: dict[uuid.UUID, dict[str, dict[str, int]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(int))
    )

    for minio_instance_id, bucket, object_key in results:
        # Extract folder path (everything except the filename)
        parts = object_key.rsplit("/", 1)
        folder_path = parts[0] if len(parts) > 1 else ""

        tree_data[minio_instance_id][bucket][folder_path] += 1

    # Convert to tree nodes
    root_nodes: list[StorageTreeNode] = []

    for instance_id, buckets in tree_data.items():
        instance_name = instance_map.get(instance_id, str(instance_id))
        instance_total = sum(
            sum(folders.values()) for folders in buckets.values()
        )

        bucket_nodes: list[StorageTreeNode] = []

        for bucket_name, folders in buckets.items():
            bucket_total = sum(folders.values())

            # Build folder hierarchy
            folder_nodes = _build_folder_tree(
                folders, str(instance_id), bucket_name
            )

            bucket_node = StorageTreeNode(
                id=f"{instance_id}:{bucket_name}",
                name=bucket_name,
                type="bucket",
                path=f"{instance_id}:{bucket_name}",
                count=bucket_total,
                children=folder_nodes,
            )
            bucket_nodes.append(bucket_node)

        instance_node = StorageTreeNode(
            id=str(instance_id),
            name=instance_name,
            type="instance",
            path=str(instance_id),
            count=instance_total,
            children=sorted(bucket_nodes, key=lambda x: x.name),
        )
        root_nodes.append(instance_node)

    return sorted(root_nodes, key=lambda x: x.name)


def _build_folder_tree(
    folders: dict[str, int],
    instance_id: str,
    bucket: str,
) -> list[StorageTreeNode]:
    """Build folder hierarchy from flat folder paths.

    Args:
        folders: Dict mapping folder paths to sample counts
        instance_id: MinIO instance ID
        bucket: Bucket name

    Returns:
        List of root-level folder nodes with nested children
    """
    if not folders:
        return []

    # Build a tree structure from paths
    # Each node: {name, count, children: {}}
    tree: dict = {}

    for folder_path, count in folders.items():
        if not folder_path:
            # Root level files (no folder)
            continue

        parts = folder_path.split("/")
        current = tree

        for i, part in enumerate(parts):
            if part not in current:
                current[part] = {"_count": 0, "_children": {}}
            current = current[part]
            if i == len(parts) - 1:
                current["_count"] += count
            current = current["_children"]

    def build_nodes(
        subtree: dict, parent_path: str
    ) -> list[StorageTreeNode]:
        nodes: list[StorageTreeNode] = []

        for name, data in subtree.items():
            if name.startswith("_"):
                continue

            current_path = f"{parent_path}/{name}" if parent_path else name
            full_path = f"{instance_id}:{bucket}:{current_path}"

            children = build_nodes(data.get("_children", {}), current_path)

            # Calculate total count including children
            direct_count = data.get("_count", 0)
            total_count = direct_count + sum(c.count for c in children)

            node = StorageTreeNode(
                id=full_path,
                name=name,
                type="folder",
                path=full_path,
                count=total_count,
                children=sorted(children, key=lambda x: x.name),
            )
            nodes.append(node)

        return nodes

    return build_nodes(tree, "")
