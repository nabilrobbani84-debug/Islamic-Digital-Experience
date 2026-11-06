import { describe, expect, it } from "vitest";
import type { User } from "@/types/domain";
import { can, hasRole } from "./auth";

const user = (role: User["role"]): User => ({ id: "1", name: "A", email: "a@b.c", role, emailVerified: true, createdAt: "2026-01-01T00:00:00Z" });

describe("RBAC UI", () => {
  it("USER tidak dapat mengakses admin", () => {
    expect(can(user("USER"), "admin:access")).toBe(false);
    expect(can(null, "admin:access")).toBe(false);
  });
  it("ADMIN dapat mengelola konten tetapi tidak mengubah peran", () => {
    expect(can(user("ADMIN"), "admin:content")).toBe(true);
    expect(can(user("ADMIN"), "admin:users:manage-roles")).toBe(false);
  });
  it("SUPER_ADMIN memiliki seluruh izin", () => {
    expect(can(user("SUPER_ADMIN"), "admin:users:manage-roles")).toBe(true);
    expect(hasRole(user("SUPER_ADMIN"), ["ADMIN", "SUPER_ADMIN"])).toBe(true);
  });
});
