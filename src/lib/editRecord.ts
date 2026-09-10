function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object")
    return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.hasOwn(right, key) &&
        sameValue(
          (left as Record<string, unknown>)[key],
          (right as Record<string, unknown>)[key],
        ),
    )
  );
}

/** Merge a form's changed fields against the latest record inside a transaction. */
export function mergeEditedRecord<T extends { id: string }>(
  latest: T | null,
  original: T | null,
  edited: T,
  fields: readonly (keyof T)[],
): T {
  if (
    !edited.id ||
    (original && original.id !== edited.id) ||
    (latest && latest.id !== edited.id)
  ) {
    throw new Error("记录编号不一致，请重新打开后重试。");
  }
  if (!original) {
    if (latest)
      throw new Error("此记录已存在，请重新打开后编辑，避免重复创建。");
    return { ...edited };
  }
  if (!latest)
    throw new Error(
      "此记录已被删除，无法保存旧草稿。请保留草稿内容并重新检查。",
    );

  const changed = fields.filter(
    (field) => field !== "id" && !sameValue(edited[field], original[field]),
  );
  if (
    changed.some(
      (field) =>
        !sameValue(latest[field], original[field]) &&
        !sameValue(latest[field], edited[field]),
    )
  ) {
    throw new Error(
      "你修改的内容已被其他成员更新。草稿已保留，请复制需要保留的内容，再重新打开核对。",
    );
  }
  const merged = { ...latest };
  for (const field of changed) merged[field] = edited[field];
  return merged;
}
