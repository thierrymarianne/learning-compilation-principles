import antlr4 from 'antlr4/index';
import JSONLexer from './JSONLexer';
import JSONParser from './JSONParser';
import JSONDrawer from './JSONDrawer';
import AntlrError from './AntlrError';

const parseJSON = (inputText, component) => {
  try {
    const chars = new antlr4.InputStream(inputText);
    const lexer = new JSONLexer.JSONLexer(chars);
    const tokens = new antlr4.CommonTokenStream(lexer);
    const parser = new JSONParser.JSONParser(tokens);
    parser.buildParseTrees = true;
    const tree = parser.json();
    const drawer = new JSONDrawer(component);
    antlr4.tree.ParseTreeWalker.DEFAULT.walk(drawer, tree);
  } catch (error) {
    throw new AntlrError(error.message);
  }
};

export default {
  AntlrError,
  parseJSON,
};