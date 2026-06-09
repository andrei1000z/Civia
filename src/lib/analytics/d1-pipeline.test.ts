import { describe, it, expect } from "vitest";
import { D1Pipeline } from "./d1-client";

const countPlaceholders = (sql: string) => (sql.match(/\?/g) || []).length;

describe("D1Pipeline — colectare statements (batch perf)", () => {
  it("hincrby → 1 statement cu SQL + params corecte", () => {
    const stmts = new D1Pipeline().hincrby("k", "f", 5).statements;
    expect(stmts).toHaveLength(1);
    expect(stmts[0]!.sql).toContain("INSERT INTO hash_kv");
    expect(stmts[0]!.params).toEqual(["k", "f", "5", 5]);
  });

  it("expire + del produc câte 5 statements (toate cele 5 tabele de storage)", () => {
    expect(new D1Pipeline().expire("k", 60).statements).toHaveLength(5);
    expect(new D1Pipeline().del("k").statements).toHaveLength(5);
    const tables = new D1Pipeline().del("k").statements.map((s) => s.sql.match(/FROM (\w+)/)![1]);
    expect(new Set(tables)).toEqual(new Set(["kv", "hash_kv", "set_kv", "list_kv", "zset_kv"]));
  });

  it("sadd/lpush/zrem produc câte 1 statement per membru/valoare", () => {
    expect(new D1Pipeline().sadd("k", "a", "b", "c").statements).toHaveLength(3);
    expect(new D1Pipeline().lpush("k", "x", "y").statements).toHaveLength(2);
    expect(new D1Pipeline().zrem("k", "m1", "m2").statements[0]!.params).toEqual(["k", "m1", "m2"]);
  });

  it("CRITIC: fiecare statement are params.length === nr. de ? (binding pozițional la concatenare)", () => {
    const p = new D1Pipeline()
      .hincrby("k", "views", 1)
      .hset("k", { a: 1, b: 2 })
      .hsetnx("k", "f", "v")
      .expire("k", 60)
      .sadd("dau", "visitor1")
      .lpush("list", "v1", "v2")
      .ltrim("list", 0, 99)
      .ltrim("list", 0, -1)
      .zadd("z", { score: 5, member: "m" })
      .zincrby("z", 2, "m")
      .zrem("z", "m1", "m2")
      .srem("s", "m1")
      .del("old");
    for (const s of p.statements) {
      expect(countPlaceholders(s.sql), `params nealiniate pe: ${s.sql}`).toBe(s.params.length);
    }
    // total: 1+2+1+5+1+2+1+1+1+1+1+1+5 = 23
    expect(p.statements.length).toBe(23);
  });

  it("chaining returnează this (fluent) + statements se acumulează", () => {
    const p = new D1Pipeline();
    expect(p.hincrby("a", "x", 1)).toBe(p);
    expect(p.sadd("b", "m")).toBe(p);
    expect(p.statements.length).toBe(2);
  });
});
