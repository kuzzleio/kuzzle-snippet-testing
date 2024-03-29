const
  _ = require('lodash'),
  fs = require('fs'),
  glob = require('glob-promise'),
  path = require('path'),
  readYaml = require('read-yaml'),
  Runner = require('./runner'),
  ServiceContainer = require('./services'),
  Snippet = require('./snippet');

class Suite {

  constructor() {
    this.config = _.defaultsDeep(readYaml.sync(process.env.CONFIG_FILE), {
      docker: {
        socketPath: '/var/run/docker.sock'
      },
      runners: {
        default: false
      },
      snippets: {
        dest: '/var/snippets',
        mount: '/mnt',
        path: '**/snippets/*.test.yml',
        protocols: ['websocket']
      }
    });

    if (process.argv.length >= 3) {
      this.config.snippets.path = process.argv[2];
    }

    try {
      if (fs.statSync(path.join(this.config.snippets.mount, this.config.snippets.path)).isDirectory()) {
        this.config.snippets.path += '/**/*.test.yml';
      }
    }
    catch (e) {
      // a glob pattern with wildcards will fail the stat call
      // do nothing
    }

    this.snippetsTree = {};
    this.services = new ServiceContainer(this);
  }

  async init () {
    const snippetPath = path.join(this.config.snippets.mount, this.config.snippets.path);
    console.log(`scanning ${snippetPath}`);

    const snippetFiles = glob.sync(snippetPath)
      .filter(file => file.endsWith('.test.yml'));

    console.log(` ..${snippetFiles.length} snippets found\n`);

    for (const snippetFile of snippetFiles) {
      const snippet = new Snippet(snippetFile, this.config);

      if (!this.snippetsTree[snippet.runner]) {
        this.snippetsTree[snippet.runner] = [];
      }
      this.snippetsTree[snippet.runner].push(snippet);
    }

    await this.services.init();

    for (const runnerName of Object.keys(this.snippetsTree)) {
      const runnerConfig = this.config.runners[runnerName];
      
      const container = this.services.docker.getContainer(runnerConfig.service);
      if (runnerConfig.afterInit) {
        await container.exec(runnerConfig.afterInit, {
          printStdout: true,
          printStderr: true,
        });
      }
    }
  }

  render () {
    for (const runnerName of Object.keys(this.snippetsTree)) {
      for (const snippet of this.snippetsTree[runnerName]) {
        snippet.render();
      }
    }
  }

  async lint () {
    for (const runnerName of Object.keys(this.snippetsTree)) {
      const runner = new Runner(this, runnerName, this.config.runners[runnerName]);

      if (runner.config.lint.global) {
        try {
          await runner.lintAll();
          this.services.logger.logRunnerSuccess(runner, 'lint ok');
        } catch (e) {
          this.services.logger.logRunnerError(runner, e);
          process.exit(1);
        }
      }
      else {
        for (const snippet of this.snippetsTree[runnerName]) {
          try {
            await runner.lint(snippet);
          } catch (e) {
            this.services.logger.logSnippetError(snippet, e);
            process.exit(1);
          }
        }
      }
    }
  }

  async run () {
    for (const runnerName of Object.keys(this.snippetsTree)) {
      const runner = new Runner(this, runnerName, this.config.runners[runnerName]);

      for (const snippet of this.snippetsTree[runnerName]) {
        for (const protocol of snippet.protocols) {
          try {
            await runner.run(snippet, protocol);
            this.services.logger.logSnippetSuccess(snippet, protocol);
          } catch (e) {
            snippet.display();
            this.services.logger.logSnippetError(snippet, protocol, e);
            process.exit(1);
          }
        }
      }
    }
  }

}

module.exports = Suite;
