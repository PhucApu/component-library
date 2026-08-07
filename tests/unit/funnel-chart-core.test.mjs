import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BAR_VAR,
  STAGE_LIMIT,
  STAGE_VARS,
  colourFor,
  fillLabel,
  formatNumber,
  formatRate,
  overallRate,
  parseValue,
  risingStages,
  stageMetrics,
  usableStages,
  worstDropIndex,
} from '../../components/funnel-chart/source/funnel-chart-core.js';

const CHECKOUT = [
  { name: 'Viewed product', value: 18400, text: '18,400' },
  { name: 'Added to cart', value: 6200, text: '6,200' },
  { name: 'Started checkout', value: 4380, text: '4,380' },
  { name: 'Paid', value: 2140, text: '2,140' },
];

describe('parseValue', () => {
  it('reads the number out of a cell written for a person', () => {
    assert.equal(parseValue('18,400'), 18400);
    assert.equal(parseValue('$2,140'), 2140);
    assert.equal(parseValue('0'), 0);
  });

  it('lets data-value settle what it cannot be sure about', () => {
    assert.equal(parseValue('1.2k', '1200'), 1200);
  });

  it('says nothing rather than inventing a number', () => {
    assert.equal(parseValue('n/a'), null);
    assert.equal(parseValue(''), null);
    assert.equal(parseValue(null), null);
  });
});

describe('usableStages', () => {
  it('keeps a measured zero, which is a real stage nobody reached', () => {
    const { usable, dropped } = usableStages([
      { name: 'Saw the ad', value: 0 },
      { name: 'Bought', value: 0 },
    ]);

    assert.equal(usable.length, 2);
    assert.equal(dropped, 0);
  });

  it('drops what cannot be a stage and counts it rather than renumbering the funnel', () => {
    const { usable, dropped } = usableStages([
      { name: 'Applied', value: 1240 },
      { name: 'Broken row', value: null },
      { name: 'Impossible', value: -40 },
      { name: 'Hired', value: 31 },
    ]);

    assert.deepEqual(
      usable.map((stage) => stage.name),
      ['Applied', 'Hired'],
    );
    assert.equal(dropped, 2);
  });
});

describe('stageMetrics', () => {
  it('gives a first stage no rate against a stage that does not exist', () => {
    const [first] = stageMetrics(CHECKOUT);

    // Not 1. A first stage is not "100% of the previous stage"; printing that invents one.
    assert.equal(first.stepRate, null);
    assert.equal(first.drop, null);
    assert.equal(first.topRate, 1);
  });

  it('answers two different questions with two different rates', () => {
    const stages = stageMetrics(CHECKOUT);

    // Of the people who got here, how many went on: 4,380 of 6,200.
    assert.equal(stages[2].stepRate.toFixed(4), '0.7065');
    // Of everyone who entered, how many got this far: 4,380 of 18,400.
    assert.equal(stages[2].topRate.toFixed(4), '0.2380');
  });

  it('reports the loss as people rather than only as a rate', () => {
    const stages = stageMetrics(CHECKOUT);

    assert.equal(stages[1].drop, 12200);
    assert.equal(stages[3].drop, 2240);
  });

  it('measures the bars against the tallest stage by default', () => {
    const stages = stageMetrics(CHECKOUT);

    assert.equal(stages[0].fraction, 1);
    assert.equal(stages[1].fraction.toFixed(4), '0.3370');
  });

  it('draws to a pinned ceiling so two funnels can share one ruler', () => {
    // Left to itself the mobile funnel scales to its own top and draws a full-width first bar,
    // which is the comparison that quietly lies when it sits beside a bigger one.
    const mobile = [
      { name: 'Viewed product', value: 6900 },
      { name: 'Paid', value: 470 },
    ];

    assert.equal(stageMetrics(mobile)[0].fraction, 1);
    assert.equal(stageMetrics(mobile, { max: 18400 })[0].fraction.toFixed(4), '0.3750');
  });

  it('puts the loss where it happened, running back to the previous bar', () => {
    const stages = stageMetrics(CHECKOUT);

    // The drop region begins where this bar ends and ends where the previous one did.
    assert.equal(
      (stages[1].fraction + stages[1].dropFraction).toFixed(6),
      stages[0].fraction.toFixed(6),
    );
    assert.equal(
      (stages[2].fraction + stages[2].dropFraction).toFixed(6),
      stages[1].fraction.toFixed(6),
    );
  });

  it('has no drop region to draw for a stage that grew', () => {
    const stages = stageMetrics([
      { name: 'Invited', value: 820 },
      { name: 'Joined', value: 900 },
    ]);

    assert.equal(stages[1].drop, -80);
    assert.equal(stages[1].dropFraction, 0);
  });

  it('keeps a risen stage inside its own track rather than overflowing it', () => {
    const stages = stageMetrics([
      { name: 'Invited', value: 820 },
      { name: 'Joined', value: 900 },
    ]);

    assert.equal(stages[1].fraction, 1);
    assert.ok(stages.every((stage) => stage.fraction <= 1));
  });

  it('reports no rate at all rather than NaN when nobody entered', () => {
    const stages = stageMetrics([
      { name: 'Saw the ad', value: 0 },
      { name: 'Bought', value: 0 },
    ]);

    assert.equal(stages[0].topRate, null);
    assert.equal(stages[1].topRate, null);
    assert.equal(stages[1].stepRate, null);
    assert.equal(stages[1].fraction, 0);
  });
});

describe('worstDropIndex', () => {
  it('finds the largest loss by count, not by rate', () => {
    // Built so the two measures genuinely disagree. The worst *rate* is the last step, which
    // keeps 5% — but it only costs 3,610 people, because the funnel was already thin by then.
    // The worst *count* is the first step at 5,000, and that is where the work is.
    const stages = stageMetrics([
      { name: 'Top', value: 10000 },
      { name: 'Second', value: 5000 },
      { name: 'Third', value: 4000 },
      { name: 'Fourth', value: 3800 },
      { name: 'Last', value: 190 },
    ]);

    assert.deepEqual(
      stages.map((stage) => stage.drop),
      [null, 5000, 1000, 200, 3610],
    );
    assert.equal(worstDropIndex(stages), 1);

    // The disagreement, asserted rather than assumed: the worst rate is somewhere else.
    const worstRateAt = stages.reduce(
      (low, stage, index) =>
        stage.stepRate !== null && (low < 0 || stage.stepRate < stages[low].stepRate)
          ? index
          : low,
      -1,
    );

    assert.equal(worstRateAt, 4);
    assert.equal(stages[4].stepRate.toFixed(2), '0.05');
  });

  it('settles a tie on the earlier stage rather than arbitrarily', () => {
    const stages = stageMetrics([
      { name: 'One', value: 100 },
      { name: 'Two', value: 70 },
      { name: 'Three', value: 40 },
    ]);

    assert.equal(stages[1].drop, 30);
    assert.equal(stages[2].drop, 30);
    assert.equal(worstDropIndex(stages), 1);
  });

  it('marks nothing when nothing was lost', () => {
    assert.equal(worstDropIndex(stageMetrics([{ name: 'Only', value: 318 }])), -1);
    assert.equal(
      worstDropIndex(
        stageMetrics([
          { name: 'Top', value: 0 },
          { name: 'Bottom', value: 0 },
        ]),
      ),
      -1,
    );
  });
});

describe('risingStages', () => {
  it('names the stages that are bigger than the one before them', () => {
    const stages = stageMetrics([
      { name: 'Invited', value: 820 },
      { name: 'Accepted', value: 610 },
      { name: 'Joined a workspace', value: 705 },
      { name: 'Completed setup', value: 480 },
    ]);

    assert.deepEqual(
      risingStages(stages).map((stage) => stage.name),
      ['Joined a workspace'],
    );
  });

  it('finds nothing to report on a well-formed funnel', () => {
    assert.deepEqual(risingStages(stageMetrics(CHECKOUT)), []);
  });

  it('does not call an unchanged stage a rise', () => {
    const stages = stageMetrics([
      { name: 'One', value: 100 },
      { name: 'Two', value: 100 },
    ]);

    assert.deepEqual(risingStages(stages), []);
  });
});

describe('overallRate', () => {
  it('reports first stage to last, which is what the funnel exists to produce', () => {
    assert.equal(overallRate(stageMetrics(CHECKOUT)).toFixed(4), '0.1163');
  });

  it('has nothing to report for a single stage or an empty top', () => {
    assert.equal(overallRate(stageMetrics([{ name: 'Only', value: 318 }])), null);
    assert.equal(overallRate([]), null);
    assert.equal(
      overallRate(
        stageMetrics([
          { name: 'Top', value: 0 },
          { name: 'Bottom', value: 0 },
        ]),
      ),
      null,
    );
  });
});

describe('colourFor', () => {
  it('gives every stage one colour by default', () => {
    // Position already carries the order and length already carries the value. Shading each
    // stage differently would spend the only free channel restating the order.
    const painted = CHECKOUT.map((unused, index) => colourFor(index));

    assert.deepEqual([...new Set(painted)], [BAR_VAR]);
  });

  it('walks the ordinal ramp when the shading is asked for', () => {
    const painted = Array.from({ length: STAGE_LIMIT }, (unused, index) =>
      colourFor(index, { shade: 'stages' }),
    );

    assert.deepEqual(painted, [...STAGE_VARS]);
    assert.equal(new Set(painted).size, STAGE_LIMIT);
  });

  it('keeps the default bar out of the ramp rather than sharing a token', () => {
    // The default bar is the accent at full strength; the ramp's first step is its palest
    // rung. One token cannot be both without one of the two measurements being wrong.
    assert.notEqual(BAR_VAR, STAGE_VARS[0]);
  });

  it('falls back to one colour past the end of the ramp', () => {
    assert.equal(colourFor(STAGE_LIMIT, { shade: 'stages' }), BAR_VAR);
    assert.equal(colourFor(-1, { shade: 'stages' }), BAR_VAR);
  });

  it('never builds a property name out of an index', () => {
    // A `var()` assembled at runtime is invisible to every tool that reads the stylesheet,
    // including this repository's own validator.
    STAGE_VARS.forEach((token) => assert.match(token, /^var\(--funnel-stage-\d\)$/));
  });
});

describe('formatting', () => {
  it('gives a rate one decimal, because it is not a measurement to six figures', () => {
    assert.equal(formatRate(0.3369), '33.7%');
    assert.equal(formatRate(0.5), '50%');
    assert.equal(formatRate(0.0223), '2.2%');
    assert.equal(formatRate(null), '');
  });

  it('separates thousands in a figure nobody wrote out', () => {
    assert.equal(formatNumber(12200), '12,200');
    assert.equal(formatNumber(Number.NaN), '');
  });

  it('leaves nothing ragged when a template has no value for a slot', () => {
    assert.equal(fillLabel('{rate} of previous', { rate: '33.7%' }), '33.7% of previous');
    assert.equal(fillLabel('{count} lost', {}), 'lost');
  });
});
