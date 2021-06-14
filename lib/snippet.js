const
  crypto = require('crypto'),
  fs = require('fs'),
  glob = require('glob-promise'),
  indentString = require('indent-string'),
  path = require('path'),
  readYaml = require('read-yaml'),
  sanitize = require('sanitize-filename'),
  { execSync } = require('child_process'),
  { TestError } = require('./errors');

const JAVA_GENERIC_CLASS = 'CodeExampleGenericClass';

class Snippet {
  constructor (definitionFile, config = {}) {
    const def = readYaml.sync(definitionFile);

    this.definitionFile = definitionFile;
    this.hash = crypto.createHash('sha256').update(this.definitionFile).digest('hex').substring(0, 7);

    this.name = sanitize(def.name.replace(/#/g, '')).replace(' ', '_').toLowerCase() + '_' + this.hash;
    this.description = def.description;
    this.hooks = def.hooks;
    this.expected = def.expected;
    this.template = def.template;
    this.runner = def.runner || config.runners.default;
    this.protocols = def.protocols || config.snippets.protocols || ['websocket'];

    this.snippetFile = glob.sync(this.definitionFile.replace(/\.test\.yml$/, '.*'))
      .filter(f => !f.endsWith('.test.yml'))[0];
    this.extension = this.snippetFile.replace(/^.*?\.([^.]+)$/, '$1');
    this.templateFile = path.join(config.snippets.templates, `${this.template}.tpl.${this.extension}`);

    this.destDir = config.runners[this.runner] && config.runners[this.runner].path || config.snippets.dest;
  }

  get source () {
    return `${this.name}.${this.extension}`;
  }

  render () {
    const templateContent = fs.readFileSync(this.templateFile, 'utf-8');
    if (templateContent.indexOf('[snippet-code]') === -1) {
      throw new TestError('MISSING_TAG', 'Missing [snippet-code] tag');
    }

    let snippetContent = fs.readFileSync(this.snippetFile, 'utf-8');
    if (snippetContent.endsWith('\n')) {
      snippetContent = snippetContent.slice(0, -1);
    }

    const matches = templateContent.match(/^.*\[snippet-code\].*$/m);
    const snippetIndentation = matches[0].match(/^\s*/)[0].length;
    const firstline = snippetContent.split('\n')[0];

    let rendered = templateContent.replace('[snippet-code]', firstline + indentString(snippetContent.replace(firstline, ''), snippetIndentation));

    if (this.extension === 'java') {
      rendered = rendered.replace(JAVA_GENERIC_CLASS, this.name);
    }

    fs.mkdirSync(this.destDir, {recursive: true});
    fs.writeFileSync(path.join(this.destDir, this.source), rendered);
  }

  display () {
    execSync(`cat ${path.join(this.destDir, this.source)}`);
  }
}

module.exports = Snippet;
