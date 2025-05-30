import { renderIndexAndMove } from '../view/moveView';
import type { RetroCtrl } from './retroCtrl';
import type AnalyseCtrl from '../ctrl';
import * as licon from 'lib/licon';
import { bind, dataIcon } from 'lib/snabbdom';
import { spinnerVdom as spinner } from 'lib/view/controls';
import { h, type VNode } from 'snabbdom';

function skipOrViewSolution(ctrl: RetroCtrl) {
  return h('div.choices', [
    h('a', { hook: bind('click', ctrl.viewSolution, ctrl.redraw) }, i18n.site.viewTheSolution),
    h('a', { hook: bind('click', ctrl.skip) }, i18n.site.skipThisMove),
  ]);
}

function jumpToNext(ctrl: RetroCtrl) {
  return h('a.half.continue', { hook: bind('click', ctrl.jumpToNext) }, [
    h('i', { attrs: dataIcon(licon.PlayTriangle) }),
    i18n.site.next,
  ]);
}

const minDepth = 8;
const maxDepth = 18;

function renderEvalProgress(node: Tree.Node): VNode {
  return h(
    'div.progress',
    h('div', {
      attrs: {
        style: `width: ${
          node.ceval ? (100 * Math.max(0, node.ceval.depth - minDepth)) / (maxDepth - minDepth) + '%' : 0
        }`,
      },
    }),
  );
}

const feedback = {
  find(ctrl: RetroCtrl): VNode[] {
    return [
      h('div.player', [
        h('div.no-square', h('piece.king.' + ctrl.color)),
        h('div.instruction', [
          h(
            'strong',
            i18n.site.xWasPlayed.asArray(
              h(
                'move',
                renderIndexAndMove(
                  { withDots: true, showGlyphs: true, showEval: false },
                  ctrl.current()!.fault.node,
                ),
              ),
            ),
          ),
          h('em', i18n.site[ctrl.color === 'white' ? 'findBetterMoveForWhite' : 'findBetterMoveForBlack']),
          skipOrViewSolution(ctrl),
        ]),
      ]),
    ];
  },
  // user has browsed away from the move to solve
  offTrack(ctrl: RetroCtrl): VNode[] {
    return [
      h('div.player', [
        h('div.icon.off', '!'),
        h('div.instruction', [
          h('strong', i18n.site.youBrowsedAway),
          h('div.choices.off', [h('a', { hook: bind('click', ctrl.jumpToNext) }, i18n.site.resumeLearning)]),
        ]),
      ]),
    ];
  },
  fail(ctrl: RetroCtrl): VNode[] {
    return [
      h('div.player', [
        h('div.icon', '✗'),
        h('div.instruction', [
          h('strong', i18n.site.youCanDoBetter),
          h('em', i18n.site[ctrl.color === 'white' ? 'tryAnotherMoveForWhite' : 'tryAnotherMoveForBlack']),
          skipOrViewSolution(ctrl),
        ]),
      ]),
    ];
  },
  win(ctrl: RetroCtrl): VNode[] {
    return [
      h(
        'div.half.top',
        h('div.player', [h('div.icon', '✓'), h('div.instruction', h('strong', i18n.study.goodMove))]),
      ),
      jumpToNext(ctrl),
    ];
  },
  view(ctrl: RetroCtrl): VNode[] {
    return [
      h(
        'div.half.top',
        h('div.player', [
          h('div.icon', '✓'),
          h('div.instruction', [
            h('strong', i18n.site.solution),
            h(
              'em',
              i18n.site.bestWasX.asArray(
                h(
                  'strong',
                  renderIndexAndMove({ withDots: true, showEval: false }, ctrl.current()!.solution.node),
                ),
              ),
            ),
          ]),
        ]),
      ),
      jumpToNext(ctrl),
    ];
  },
  eval(ctrl: RetroCtrl): VNode[] {
    return [
      h(
        'div.half.top',
        h('div.player.center', [
          h('div.instruction', [h('strong', i18n.site.evaluatingYourMove), renderEvalProgress(ctrl.node())]),
        ]),
      ),
    ];
  },
  end(ctrl: RetroCtrl, hasFullComputerAnalysis: () => boolean): VNode[] {
    if (!hasFullComputerAnalysis())
      return [
        h(
          'div.half.top',
          h('div.player', [h('div.icon', spinner()), h('div.instruction', i18n.site.waitingForAnalysis)]),
        ),
      ];
    const nothing = !ctrl.completion()[1];
    return [
      h('div.player', [
        h('div.no-square', h('piece.king.' + ctrl.color)),
        h('div.instruction', [
          h(
            'em',
            i18n.site[
              nothing
                ? ctrl.color === 'white'
                  ? 'noMistakesFoundForWhite'
                  : 'noMistakesFoundForBlack'
                : ctrl.color === 'white'
                  ? 'doneReviewingWhiteMistakes'
                  : 'doneReviewingBlackMistakes'
            ],
          ),
          h('div.choices.end', [
            nothing
              ? null
              : h(
                  'a',
                  {
                    key: 'reset',
                    hook: bind('click', ctrl.reset),
                  },
                  i18n.site.doItAgain,
                ),
            h(
              'a',
              {
                key: 'flip',
                hook: bind('click', ctrl.flip),
              },
              i18n.site[ctrl.color === 'white' ? 'reviewBlackMistakes' : 'reviewWhiteMistakes'],
            ),
          ]),
        ]),
      ]),
    ];
  },
};

function renderFeedback(root: AnalyseCtrl, fb: Exclude<keyof typeof feedback, 'end'>) {
  const ctrl: RetroCtrl = root.retro!;
  const current = ctrl.current();
  if (ctrl.isSolving() && current && root.path !== current.prev.path) return feedback.offTrack(ctrl);
  if (fb === 'find') return current ? feedback.find(ctrl) : feedback.end(ctrl, root.hasFullComputerAnalysis);
  return feedback[fb](ctrl);
}

export default function (root: AnalyseCtrl): VNode | undefined {
  const ctrl = root.retro;
  if (!ctrl) return;
  const fb = ctrl.feedback(),
    completion = ctrl.completion();
  return h('div.retro-box.training-box.sub-box', [
    h('div.title', [
      h('span', i18n.site.learnFromYourMistakes),
      h('span', `${Math.min(completion[0] + 1, completion[1])} / ${completion[1]}`),
      h('button.fbt', {
        hook: bind('click', root.toggleRetro, root.redraw),
        attrs: { 'data-icon': licon.X, 'aria-label': 'Close learn window' },
      }),
    ]),
    h('div.feedback.' + fb, renderFeedback(root, fb)),
  ]);
}
