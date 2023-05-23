import { Token } from "./Token";
import { Tokenizer } from "./Tokenizer";

const test1 =
  // eslint-disable-next-line no-multi-str
  'test #<\
version: "0.0.1"\
>\
foo2 : Foo  { something: "else" }\
bar2 : { bind:test.foo2.a }\
Foo : {\
  a: Str\
}\
SubFoo : Foo\
foo1 : Foo\
foo3 : SubFoo\
bar0 : { bind:test.Foo.a }\
bar1 : { bind:test.foo1.a }\
bar3 : { bind:test.foo3.a }\0';

const tokenizer1 = new Tokenizer(test1);

while (true) {
  const token = tokenizer1.next();

  console.log(tokenizer1.val);

  if (token === Token.EOF) {
    break;
  }
}
