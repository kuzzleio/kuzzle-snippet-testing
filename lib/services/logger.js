const
  {
    green,
    red,
    blue,
    yellow
  } = require('colors/safe');

class Logger {
  constructor(suite) {
    this.suite = suite;
  }

  logSnippetSuccess (snippet, protocol) {
    console.log(
      blue(`[${snippet.runner}]`),
      green('✔'),
      green(`<${protocol}> ${snippet.name}: ${snippet.description}`)
    );
  }

  /**
   * @param {Snippet} snippet
   * @param {TestError} error
   */
  logSnippetError (snippet, protocol, error) {
    console.log(
      blue(`[${snippet.runner}]`),
      red('✗'),
      yellow(`<${protocol}> ${snippet.name}: ${snippet.description}`)
    );
    console.log(red(error.code));
    console.log(red(error.message));
  }

  /**
   * @param {Runner} runner
   */
  logRunnerSuccess (runner, msg = '') {
    console.log(
      blue(`[${runner.name}]`),
      green('✔'),
      green(msg)
    );
  }

  logRunnerError (runner, error) {
    console.log(
      blue(`[${runner.name}]`),
      red('✗'),
      red(error.message)
    );
  }

  logRunner (runner, msg) {
    console.log(
      blue(`[${runner.name}]`),
      msg
    );
  }


}

module.exports = Logger;
