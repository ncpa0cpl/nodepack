const decorator = (prototype: any, key: any) => {};

export class Foo {
  @decorator
  bar(a: Array<number>): object {
    return {};
  }

  baz(a: Array<number>): object {
    return {};
  }
}
