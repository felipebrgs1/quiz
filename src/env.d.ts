/// <reference types="astro/client" />

type D1Database = import("@cloudflare/workers-types").D1Database;
type Env = import("./server/app").Env;

declare namespace App {
  interface Locals {
    runtime: {
      env: Env;
    };
  }
}
