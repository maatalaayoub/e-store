const SHOW_DELAY_MS = 120;
const MIN_VISIBLE_MS = 280;
const COMPLETE_HOLD_MS = 140;
const FADE_MS = 260;
const MAX_ACTIVE_MS = 15000;

let state = {
  visible: false,
  fading: false,
  progress: 0,
};

let activeCount = 0;
let visibleSince = 0;
let showTimer = null;
let trickleTimer = null;
let completeTimer = null;
let hideTimer = null;
let safetyTimer = null;
const subscribers = new Set();

function notify() {
  subscribers.forEach((subscriber) => subscriber());
}

function setState(patch) {
  state = { ...state, ...patch };
  notify();
}

function clearTimer(timer) {
  if (timer) clearTimeout(timer);
}

function clearIntervalTimer(timer) {
  if (timer) clearInterval(timer);
}

function clearFinishTimers() {
  clearTimer(completeTimer);
  clearTimer(hideTimer);
  completeTimer = null;
  hideTimer = null;
}

function nextProgress(progress) {
  if (progress < 35) return progress + Math.random() * 10 + 6;
  if (progress < 70) return progress + Math.random() * 6 + 3;
  if (progress < 88) return progress + Math.random() * 2.5 + 1;
  return Math.min(94, progress + Math.random() * 0.8);
}

function startTrickle() {
  clearIntervalTimer(trickleTimer);
  trickleTimer = setInterval(() => {
    if (!state.visible || state.fading || activeCount <= 0) return;
    setState({ progress: Math.min(94, nextProgress(state.progress)) });
  }, 240);
}

function show() {
  clearFinishTimers();
  visibleSince = Date.now();
  setState({
    visible: true,
    fading: false,
    progress: Math.max(state.progress || 0, 8),
  });
  startTrickle();
}

function scheduleShow() {
  if (state.visible || showTimer) return;
  showTimer = setTimeout(() => {
    showTimer = null;
    if (activeCount > 0) show();
  }, SHOW_DELAY_MS);
}

function finishNow() {
  clearTimer(showTimer);
  showTimer = null;

  if (!state.visible) {
    setState({ visible: false, fading: false, progress: 0 });
    return;
  }

  clearIntervalTimer(trickleTimer);
  trickleTimer = null;
  setState({ progress: 100, fading: false });

  completeTimer = setTimeout(() => {
    setState({ fading: true, progress: 100 });
    hideTimer = setTimeout(() => {
      if (activeCount > 0) return;
      setState({ visible: false, fading: false, progress: 0 });
    }, FADE_MS);
  }, COMPLETE_HOLD_MS);
}

function scheduleFinish() {
  if (activeCount > 0) return;
  clearTimer(safetyTimer);
  safetyTimer = null;

  const elapsed = state.visible ? Date.now() - visibleSince : 0;
  const wait = state.visible ? Math.max(0, MIN_VISIBLE_MS - elapsed) : 0;
  clearTimer(completeTimer);
  completeTimer = setTimeout(finishNow, wait);
}

export const loadingProgress = {
  subscribe(subscriber) {
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  },

  getSnapshot() {
    return state;
  },

  start() {
    clearFinishTimers();
    activeCount += 1;
    scheduleShow();

    clearTimer(safetyTimer);
    safetyTimer = setTimeout(() => {
      activeCount = 0;
      scheduleFinish();
    }, MAX_ACTIVE_MS);

    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      activeCount = Math.max(0, activeCount - 1);
      scheduleFinish();
    };
  },

  done() {
    activeCount = 0;
    scheduleFinish();
  },
};
