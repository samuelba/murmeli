const Sequencer = require('@jest/test-sequencer').default;

/** Runs e2e files in path order, so the setup flow always runs first. */
class PathSequencer extends Sequencer {
  sort(tests) {
    return [...tests].sort((a, b) => a.path.localeCompare(b.path));
  }
}

module.exports = PathSequencer;
