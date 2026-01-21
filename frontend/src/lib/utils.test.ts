import { describe, expect, it } from "vitest"
import { cn } from "./utils"

describe("cn utility function", () => {
  it("should merge class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar")
  })

  it("should handle conditional classes", () => {
    expect(cn("foo", false && "bar", "baz")).toBe("foo baz")
    expect(cn("foo", true && "bar", "baz")).toBe("foo bar baz")
  })

  it("should handle undefined and null values", () => {
    expect(cn("foo", undefined, "bar")).toBe("foo bar")
    expect(cn("foo", null, "bar")).toBe("foo bar")
  })

  it("should merge Tailwind classes correctly", () => {
    // tailwind-merge should handle conflicting classes
    expect(cn("px-2", "px-4")).toBe("px-4")
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500")
  })

  it("should handle arrays of classes", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar")
  })

  it("should handle object syntax", () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz")
  })

  it("should handle empty inputs", () => {
    expect(cn()).toBe("")
    expect(cn("")).toBe("")
  })

  it("should handle mixed inputs", () => {
    expect(cn("foo", ["bar", "baz"], { qux: true, quux: false })).toBe(
      "foo bar baz qux",
    )
  })
})
