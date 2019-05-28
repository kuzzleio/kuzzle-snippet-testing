const
  Suite = require('./lib');

(async () => {
  const suite = new Suite();

  await suite.init();

  suite.render();

  await suite.lint();
  await suite.run();
})();
