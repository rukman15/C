import "server-only";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/server/prisma";
import type { RoleUpdateRecord } from "@/lib/server/types";
import { ForbiddenError, NotFoundError } from "@/lib/server/errors";

function toRecord(u: {
  id: string;
  role: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  time: string;
  unread: boolean;
}): RoleUpdateRecord {
  return {
    id: u.id,
    role: u.role,
    type: u.type as RoleUpdateRecord["type"],
    priority: u.priority as RoleUpdateRecord["priority"],
    title: u.title,
    description: u.description,
    time: u.time,
    unread: u.unread,
  };
}

export async function listUpdates(role?: string): Promise<RoleUpdateRecord[]> {
  const rows = await prisma.roleUpdate.findMany({
    where: role ? { role } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRecord);
}

export async function createUpdate(
  input: Omit<RoleUpdateRecord, "id"> & { id?: string },
): Promise<RoleUpdateRecord> {
  const row = await prisma.roleUpdate.create({
    data: {
      id: input.id ?? `UPD-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`,
      role: input.role,
      type: input.type,
      priority: input.priority,
      title: input.title,
      description: input.description,
      time: input.time,
      unread: input.unread ?? true,
    },
  });
  return toRecord(row);
}

export async function markRead(id: string, allowedRole?: string): Promise<RoleUpdateRecord> {
  const existing = await prisma.roleUpdate.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError(`Update "${id}" tidak ditemukan`);
  if (allowedRole && existing.role !== allowedRole) {
    throw new ForbiddenError(`Update "${id}" bukan milik role ini`);
  }
  const row = await prisma.roleUpdate.update({ where: { id }, data: { unread: false } });
  return toRecord(row);
}
