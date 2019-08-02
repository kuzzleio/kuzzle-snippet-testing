const
  _ = require('lodash'),
  { TestError } = require('./errors');

class Runner {
  constructor (suite, name, config) {
    this.name = name;

    if (!config) {
      throw new TestError('MISSING_RUNNER_CONFIG', `Missing runner configuration for "${name}"`);
    }

    this.service = config.service;

    this.config = _.defaultsDeep(config, {
      lint: {
        global: false
      }
    });

    if (!this.config.path) {
      this.config.path = suite.config.snippets.dest;
    }

    this.suite = suite;
    this.services = this.suite.services;

    this.container = this.services.docker.getContainer(this.service);

    this._hasRunBeforeLint = false;
    this._hasRunBeforeBuild = false;
    this._hasRunBeforeRun = false;
  }

  async beforeBuild () {
    if (!this.config.build || !this.config.build.before) {
      return;
    }

    if (this._hasRunBeforeBuild) {
      return;
    }

    const cmd = this._templateCommand(this.config.build.before);

    this.services.logger.logRunner(this, `build [before] hook: ${cmd}`);
    const exec = await this.container.exec(this._templateCommand(cmd));

    if (exec.exitCode !== 0) {
      throw new TestError('BUILD_BEFORE_ERR', exec.output);
    }

    this._hasRunBeforeBuild = true;
  }

  async beforeLint () {
    if (!this.config.lint || !this.config.lint.before) {
      return;
    }

    if (this._hasRunBeforeLint) {
      return;
    }

    const cmd = this._templateCommand(this.config.lint.before);

    this.services.logger.logRunner(this, `lint [before] hook: ${cmd}`);
    const exec = await this.container.exec(this._templateCommand(cmd));

    if (exec.exitCode !== 0) {
      throw new TestError('LINT_BEFORE_ERR', exec.output);
    }

    this._hasRunBeforeLint = true;
  }

  async beforeRun () {
    if (!this.config.run || !this.config.run.before) {
      return;
    }

    if (this._hasRunBeforeRun) {
      return;
    }

    const cmd = this._templateCommand(this.config.run.before);

    this.services.logger.logRunner(this, `run [before] hook: ${cmd}`);
    const exec = await this.container.exec(this._templateCommand(cmd));

    if (exec.exitCode !== 0) {
      throw new TestError('RUN_BEFORE_ERR', exec.output);
    }

    this._hasRunBeforeRun = true;
  }

  async lintAll () {
    await this.beforeLint();

    const cmd = this._templateCommand(this.config.lint.cmd);
    const exec = await this.container.exec(cmd);

    if (exec.exitCode !== 0) {
      throw new TestError('LINT_ERR', `${cmd}\n${exec.output}`);
    }

    return exec;
  }

  /**
   * @param {Snippet} snippet
   * @returns {Promise<ExecResult>}
   */
  async lint (snippet) {
    await this.beforeLint();

    if (!this.config.lint || !this.config.lint.cmd) {
      return;
    }

    const exec = await this.container.exec(this._templateSnippetCommand(this.config.lint.cmd, snippet));

    if (exec.exitCode !== 0) {
      throw new TestError('LINT_ERR', exec.output);
    }

    return exec;
  }

  /**
   * @param {Snippet} snippet
   * @returns {Promise<void>}
   */
  async build (snippet) {
    await this.beforeBuild();

    if (!this.config.build || !this.config.build.cmd) {
      return;
    }

    const exec = await this.container.exec(this._templateSnippetCommand(this.config.build.cmd, snippet));

    if (exec.exitCode !== 0) {
      throw new TestError('BUILD_ERR', exec.output);
    }

    return exec;
  }

  /**
   * @param {Snippet} snippet
   * @returns {Promise<ExecResult>}
   */
  async run (snippet) {
    await this.beforeRun();

    await this.build(snippet);

    await this._runHooks(snippet, 'before');

    const exec = await this.container.exec(this._templateSnippetCommand(this.config.run.cmd, snippet));
    if (exec.exitCode !== 0) {
      throw new TestError('RUN_ERR', exec.output);
    }

    await this._runHooks(snippet, 'after');

    const expected = Array.isArray(snippet.expected) ? snippet.expected : [snippet.expected];

    let
      lastIndex = 0,
      previous = null;

    const rows = exec.output.split(/\r?\n/);

    for (const e of expected) {
      let
        index,
        match = null;

      for (index = lastIndex; index < rows.length && match === null; index++) {
        match = rows[index].match(e);
      }

      if (match === null) {
        // check if the looked up item is before a previous one
        if (previous !== null) {
          for (let i = 0; i < lastIndex && match === null; i++) {
            match = rows[i].match(e);
          }
        }

        if (match !== null) {
          throw new TestError('ERR_ORDER', `"${JSON.stringify(e, null, 2)}" found after ${JSON.stringify(previous, null, 2)} in\n${exec.output}`);
        }

        throw new TestError('ERR_ASSERTION', `"${e}" not found in \n"${exec.output}"`);
      }

      lastIndex = index;
      previous = e;
    }

    return exec;
  }

  _templateCommand (cmd) {
    return `cd ${this.config.path} && ` + cmd
      .replace('{{ snippet.dir }}', this.config.path);
  }

  _templateSnippetCommand (cmd, snippet) {
    return `cd ${snippet.destDir} && ` + cmd
      .replace('{{ snippet.name }}', snippet.name)
      .replace('{{ snippet.source }}', snippet.source)
      .replace('{{ snippet.dir }}', snippet.destDir);
  }

  async _runHooks (snippet, type) {
    if (!snippet.hooks || !snippet.hooks[type]) {
      return;
    }

    const hooks = Array.isArray(snippet.hooks[type]) ? snippet.hooks[type] : [snippet.hooks[type]];

    for (const hook of hooks) {
      const result = await this.container.exec(this._templateSnippetCommand(hook, snippet));
      if (result.exitCode !== 0) {
        throw new TestError(`ERR_HOOK_${type.toUpperCase()}`, `${hook}\n${result.output}`);
      }
    }
  }
}

module.exports = Runner;
