# Kuzzle Code Example Testing

_A simple testing framework. Programming language agnostic based on Standard Output interception and Docker containers._

**Why?**

Because sometimes you need to test multiple code examples using various programming languages and versions from your documentation.

## How to Use

This tool is meant to be used with [docker](https://www.docker.com).

This container (tests), templates the snippets and orchestrate the runner(s) to test them.

Once the stack is ready (cf below), you can launch the tests by running

```shell
docker-compose run tests [snippet/path/glob]
```

:warning: if using some wildcards in the glob expression relative to the project root, you need to escape them with single quotes to avoid your shell to expand it:
`docker-compose run tests 'doc/**/my-controller/**.test.yml'`

You can also give a directory: `docker-compose run tests doc/0/my-controller`.

If no glob pattern/directory is provided, the tool will scan the one set in `CONFIG_FILE`.

### Docker compose stack

example:

```yaml
version: '3'

services:
  tests:
    image: kuzzleio/snippets-tests
    privileged: true
    depends_on:
      - tests-runner-node
    volumes:
      - .:/mnt
      - /var/run/docker.sock:/var/run/docker.sock
      - snippets:/var/snippets
     environment:
     - CONFIG_FILE=/mnt/config.yml
   
  tests-runner-node:
    image: node:10-alpine
    command: >
      ash -c '
        npm i -g eslint;
        touch /tmp/is_ready;
        tail -f /dev/null
      '
    volumes:
      - snippets:/var/snippets

volumes:
  snippets:
```

The test container must match the following requirements:

- it must run in _privileged_ mode
- it must mount the host docker socket 
- it must obviously mount the source directory which contains the snippets to test
- it must provide the configuration file path in the `CONFIG_FILE` environment variable

Most likely, the templated snippets will need to be reached from the runners. Here, we use an internal `snippets` 
volume for this purpose.


### Test suite configuration

example:

```yaml
---
snippets:
  mount: /mnt
  path: doc/**/snippets/*.test.yml
  templates: /mnt/test/templates
  dest: /var/snippets

runners:
  default: node
  
  node:
    service: tests-runner-node
    path: /var/snippets
    lint:
      global: true
      cmd: eslint {{ snippet.dir }}
      before: timeout -t 300 -c 'until stat /tmp/is_ready; do sleep 1; done'
    run:
      cmd: node {{ snippet.source }}
      before: timeout -t 300 -c 'until stat /tmp/is_ready; do sleep 1; done'
```

#### snippets

- `mount`: The directory where the source files are mounted within the tests container.
- `path`: A [glob](https://www.npmjs.com/package/glob) pattern relative to the `mount` directory to match the snippets definition files.
- `templates`: The directory where the snippets templates are located.
- `dest` (optional): The default location to store templated snippets.
- `protocols` (optional): A list of default protocols to tests for each snippets, if not present it is defaulted to `websocket` only, can be override per snippet config.

#### runners

- `default`: which runner to use by default if not found in the `.test.yml` definition file.
- `<runner>`:
  - `service`: the docker service name as defined in the `docker-compose.yml` file
  - `path`: the path where to render and find the snippets. Overrides `snippets.dest` if set.
  - `lint`:
    - `global`: if set to `true`, will run the lint command once only. Useful if all snippets can be lint at once.
    - `cmd`: the command to execute.
    - `before` (optional): a command to execute before running the linter.
  - `build`:
    - `cmd`: the command to execute.
    - `before` (optional): a command to execute before running the build.
  - `run`:
    - `cmd`: the command to execute.
    - `before` (optional): a commmand to execute before running the test.
    
#### available variables

- `snippet.dir`: the snippets directory
- `snippet.source`: the rendered snippet file with its extension (i.e. `mySnippet.js`)
- `snippet.name`: the rendered snippet file without its extension (i.e. `mySnippet`)
- `snippet.protocol` the protocol that should execute the snippet


