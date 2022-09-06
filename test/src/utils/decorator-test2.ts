const decorator = (v: any) => (prototype: any, key: any) => {};

export class Foo {
  @decorator({ foo: ")" })
  bar(a: number): string {
    return "";
  }
}
