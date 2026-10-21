window.__ModuleLoader__.load({
  id: '@local/rest-reminder',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const STATE_KEY = 'rest-reminder:state';
    const CONFIG_KEY = 'rest-reminder:config';
    const SEC = 1000;
    const MIN = 60 * SEC;
    const TICK_MS = 1000;
    const DONE_SHOW_MS = 20 * SEC; // “休息结束”卡片自动消失时间
    const USAGE_KEY = 'rest-reminder:usage';
    const DEFAULT_CONFIG = {
      enabled: true,
      intervalMin: 60,
      restMin: 5,
      breakMin: 5,
      snoozeMin: 10,
      workOnly: false,
      workdaysOnly: true,
      workStart: '09:00',
      workEnd: '18:00',
    };
    const LIMITS = { intervalMin: [1, 480], restMin: [1, 120], breakMin: [1, 120], snoozeMin: [1, 120] };
    const PRESETS = [30, 45, 60, 90];
    const KEEP_DAYS = 30;

    // ---------- date / work-hours helpers ----------
    function pad2(n) {
      return (n < 10 ? '0' : '') + n;
    }
    function dayKey(ts) {
      const d = new Date(ts);
      return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }
    function parseHM(s) {
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || ''));
      if (!m) return null;
      const hh = Number(m[1]);
      const mm = Number(m[2]);
      if (hh > 23 || mm > 59) return null;
      return hh * 60 + mm;
    }
    function inWorkHours(cfg, ts) {
      if (!cfg.workOnly) return true;
      const d = new Date(ts);
      const day = d.getDay();
      if (cfg.workdaysOnly && (day === 0 || day === 6)) return false;
      const cur = d.getHours() * 60 + d.getMinutes();
      const s = parseHM(cfg.workStart);
      const e = parseHM(cfg.workEnd);
      if (s === null || e === null || s === e) return true;
      return s < e ? cur >= s && cur < e : cur >= s || cur < e; // 支持跨零点的时段
    }

    function readJson(key) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }
    function writeJson(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        /* ignore quota / privacy mode */
      }
    }
    function fmt(totalSec) {
      const s = Math.max(0, Math.round(totalSec));
      const m = Math.floor(s / 60);
      const r = s % 60;
      return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
    }

    // ---------- locale ----------
    const localeBus = (function () {
      let version = 0;
      let getter = null;
      const listeners = new Set();
      return {
        subscribe(fn) {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
        version: () => version,
        bump() {
          version += 1;
          listeners.forEach((fn) => fn());
        },
        setGetter(fn) {
          getter = fn;
        },
        active() {
          try {
            const snap = getter && getter();
            const a = snap && snap.active;
            const id = typeof a === 'string' ? a : a && (a.id || a.locale);
            if (typeof id === 'string') return id;
          } catch (e) {
            /* fall through */
          }
          return String(navigator.language || '');
        },
      };
    })();
    const isZh = () => localeBus.active().toLowerCase().startsWith('zh');

    const TEXT = {
      zh: {
        title: '该休息一下了',
        body: (m) => '你已经连续使用约 ' + m + ' 分钟了。起身活动一下，让眼睛和肩颈放松几分钟。',
        startRest: (m) => '开始休息 ' + m + ' 分钟',
        snooze: (m) => m + ' 分钟后再提醒',
        restingTitle: '休息中',
        restingSub: '离开屏幕，放松一下',
        restEarly: '提前结束',
        restMore: '再休息 1 分钟',
        doneTitle: '休息结束',
        doneBody: '状态恢复了吗？继续加油。',
        doneOk: '好的',
        tips: [
          '远眺 6 米外的物体 20 秒，缓解眼疲劳',
          '站起来活动肩颈，慢慢转动头部',
          '喝一杯水，顺便走动走动',
          '闭上眼睛深呼吸几次',
          '伸展手腕和手指，放松双手',
        ],
        setTitle: '休息提醒',
        setDesc: '连续使用一段时间后提醒你起身休息，并在休息时显示倒计时。',
        statusWork: '距下次提醒',
        statusWorkHint: '仅在有操作时计时，空闲时暂停',
        statusDue: '该休息了',
        statusRest: '休息中，剩余',
        statusDone: '休息已结束',
        statusOff: '提醒已关闭',
        statusUsed: (m) => '本轮已连续使用约 ' + m + ' 分钟',
        restNow: '立即休息',
        preview: '预览提醒',
        secRemind: '提醒规则',
        enabled: '启用提醒',
        enabledHint: '关闭后不再提醒，也不计时',
        interval: '提醒间隔',
        intervalHint: '连续使用满这么久就提醒',
        rest: '休息时长',
        restHint: '点“开始休息”后的倒计时长度',
        secAdvanced: '高级',
        brk: '空闲判定',
        brkHint: '无操作超过这么久，视为已自行休息并重新计时',
        snoozeLabel: '推迟时长',
        snoozeHint: '点“稍后提醒”后多久再提醒',
        unit: '分钟',
        reset: '恢复默认',
        secUsage: '使用统计',
        today: '今日已使用',
        weekTitle: '最近 7 天（分钟）',
        weekdays: ['日', '一', '二', '三', '四', '五', '六'],
        hm: (m) => (m >= 60 ? Math.floor(m / 60) + ' 小时 ' + (m % 60) + ' 分钟' : m + ' 分钟'),
        secHours: '工作时段',
        workOnly: '仅在工作时段提醒',
        workOnlyHint: '时段外只统计使用时长，不计时、不弹窗',
        workdaysOnly: '仅工作日',
        workdaysOnlyHint: '周六、周日不提醒',
        workRange: '时段',
        statusOffHours: '当前不在工作时段，暂停提醒',
      },
      en: {
        title: 'Time for a break',
        body: (m) => "You've been working for about " + m + ' minutes. Stand up and give your eyes and shoulders a rest.',
        startRest: (m) => 'Rest for ' + m + ' min',
        snooze: (m) => 'Remind me in ' + m + ' min',
        restingTitle: 'On a break',
        restingSub: 'Step away from the screen',
        restEarly: 'End early',
        restMore: '+1 minute',
        doneTitle: 'Break is over',
        doneBody: 'Feeling refreshed? Back to it.',
        doneOk: 'OK',
        tips: [
          'Look at something 20 feet away for 20 seconds',
          'Stand up and gently roll your neck and shoulders',
          'Drink some water and walk around',
          'Close your eyes and take a few deep breaths',
          'Stretch your wrists and fingers',
        ],
        setTitle: 'Rest reminder',
        setDesc: 'Reminds you to take a break after continuous use, with a countdown while you rest.',
        statusWork: 'Next reminder in',
        statusWorkHint: 'Counts only while you are active',
        statusDue: 'Time for a break',
        statusRest: 'On a break, remaining',
        statusDone: 'Break finished',
        statusOff: 'Reminders are off',
        statusUsed: (m) => 'Current streak: about ' + m + ' min',
        restNow: 'Rest now',
        preview: 'Preview',
        secRemind: 'Reminder',
        enabled: 'Enable reminders',
        enabledHint: 'When off, nothing is counted or shown',
        interval: 'Reminder interval',
        intervalHint: 'Remind after this much continuous use',
        rest: 'Break length',
        restHint: 'Countdown length once you start a break',
        secAdvanced: 'Advanced',
        brk: 'Idle detection',
        brkHint: 'Idle for this long counts as a break and restarts the timer',
        snoozeLabel: 'Snooze length',
        snoozeHint: 'How long to wait after pressing snooze',
        unit: 'min',
        reset: 'Reset to defaults',
        secUsage: 'Usage',
        today: 'Used today',
        weekTitle: 'Last 7 days (min)',
        weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        hm: (m) => (m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min'),
        secHours: 'Work hours',
        workOnly: 'Remind only during work hours',
        workOnlyHint: 'Outside the window usage is tracked but nothing is counted or shown',
        workdaysOnly: 'Weekdays only',
        workdaysOnlyHint: 'No reminders on Saturday and Sunday',
        workRange: 'Window',
        statusOffHours: 'Outside work hours, reminders paused',
      },
    };
    const T = () => (isZh() ? TEXT.zh : TEXT.en);

    // ---------- config store (persisted, observable) ----------
    function clamp(key, v) {
      const [lo, hi] = LIMITS[key];
      return Math.min(hi, Math.max(lo, Math.round(v)));
    }
    function normalizeConfig(raw) {
      const c = raw || {};
      const out = {
        enabled: c.enabled === false ? false : true,
        workOnly: c.workOnly === true,
        workdaysOnly: c.workdaysOnly === false ? false : true,
        workStart: parseHM(c.workStart) !== null ? c.workStart : DEFAULT_CONFIG.workStart,
        workEnd: parseHM(c.workEnd) !== null ? c.workEnd : DEFAULT_CONFIG.workEnd,
      };
      for (const k of Object.keys(LIMITS)) {
        out[k] = typeof c[k] === 'number' && isFinite(c[k]) ? clamp(k, c[k]) : DEFAULT_CONFIG[k];
      }
      return out;
    }
    const configStore = (function () {
      let cfg = normalizeConfig(readJson(CONFIG_KEY));
      const listeners = new Set();
      const emit = () => listeners.forEach((fn) => fn());
      return {
        get: () => cfg,
        subscribe(fn) {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
        set(patch) {
          const next = normalizeConfig(Object.assign({}, cfg, patch));
          if (JSON.stringify(next) === JSON.stringify(cfg)) return;
          cfg = next;
          writeJson(CONFIG_KEY, cfg);
          emit();
        },
        reset() {
          cfg = normalizeConfig(null);
          writeJson(CONFIG_KEY, cfg);
          emit();
        },
        reload() {
          const next = normalizeConfig(readJson(CONFIG_KEY));
          if (JSON.stringify(next) !== JSON.stringify(cfg)) {
            cfg = next;
            emit();
          }
        },
      };
    })();

    // ---------- timing store ----------
    // phase: work（工作中）| due（到点提醒）| rest（休息倒计时）| done（休息结束提示）
    function createStore() {
      const now0 = Date.now();
      const cfg0 = configStore.get();
      const saved = readJson(STATE_KEY);
      let state = {
        activeMs: 0,
        lastActiveAt: now0,
        lastTickAt: now0,
        nextRemindMs: cfg0.intervalMin * MIN,
        intervalMin: cfg0.intervalMin,
        due: false,
        restUntil: 0,
        restTotalMs: 0,
        doneUntil: 0,
        tip: 0,
      };
      // 关闭页面期间空闲超过空闲阈值，视为已休息，重新计时；休息倒计时未结束则继续
      const resting = saved && typeof saved.restUntil === 'number' && saved.restUntil > now0;
      if (saved && typeof saved.lastTickAt === 'number' && (resting || now0 - saved.lastActiveAt < cfg0.breakMin * MIN)) {
        state = Object.assign(state, saved, { lastTickAt: now0 });
      }
      if (!resting) state.restUntil = 0;
      if (state.doneUntil <= now0) state.doneUntil = 0;

      const listeners = new Set();
      const emit = () => listeners.forEach((fn) => fn());

      // 每日累计使用时长（毫秒），只保留最近 KEEP_DAYS 天
      let usage = (function () {
        const raw = readJson(USAGE_KEY);
        const out = {};
        if (raw && typeof raw === 'object') {
          Object.keys(raw).forEach((k) => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof raw[k] === 'number' && raw[k] > 0) out[k] = raw[k];
          });
        }
        return out;
      })();
      function addUsage(now, dt) {
        const k = dayKey(now);
        usage[k] = (usage[k] || 0) + dt;
      }
      function pruneUsage(now) {
        const keep = {};
        for (let i = 0; i < KEEP_DAYS; i++) {
          const k = dayKey(now - i * 86400000);
          if (usage[k]) keep[k] = usage[k];
        }
        usage = keep;
      }
      function weekMinutes(now) {
        const out = [];
        for (let i = 6; i >= 0; i--) {
          const ts = now - i * 86400000;
          out.push({ day: new Date(ts).getDay(), min: Math.round((usage[dayKey(ts)] || 0) / MIN) });
        }
        return out;
      }
      pruneUsage(now0);
      let lastUsageSave = 0;

      function compute() {
        const now = Date.now();
        const cfg = configStore.get();
        const inHours = inWorkHours(cfg, now);
        let phase = 'work';
        if (state.restUntil > now) phase = 'rest';
        else if (state.doneUntil > now) phase = 'done';
        else if (state.due && inHours) phase = 'due';
        return {
          phase,
          offHours: cfg.enabled && !inHours,
          minutes: Math.round(state.activeMs / MIN),
          restLeft: phase === 'rest' ? Math.ceil((state.restUntil - now) / SEC) : 0,
          restTotal: Math.round(state.restTotalMs / SEC),
          nextIn: phase === 'work' && cfg.enabled ? Math.ceil(Math.max(0, state.nextRemindMs - state.activeMs) / SEC) : 0,
          tip: state.tip,
          todayMin: Math.round((usage[dayKey(now)] || 0) / MIN),
          week: weekMinutes(now),
        };
      }
      let snapshot = compute();
      function publish() {
        const next = compute();
        if (JSON.stringify(next) !== JSON.stringify(snapshot)) {
          snapshot = next;
          emit();
        }
      }
      function persist() {
        writeJson(STATE_KEY, state);
        const t = Date.now();
        if (t - lastUsageSave >= 10 * SEC) {
          lastUsageSave = t;
          writeJson(USAGE_KEY, usage);
        }
      }
      function resetCycle(cfg) {
        state.activeMs = 0;
        state.nextRemindMs = cfg.intervalMin * MIN;
        state.intervalMin = cfg.intervalMin;
        state.due = false;
      }
      function startRest(ms) {
        const cfg = configStore.get();
        const now = Date.now();
        resetCycle(cfg);
        state.restTotalMs = ms;
        state.restUntil = now + ms;
        state.doneUntil = 0;
        state.lastActiveAt = now;
        state.tip = Math.floor(Math.random() * 1000);
      }

      return {
        subscribe(fn) {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
        getSnapshot: () => snapshot,
        touch() {
          state.lastActiveAt = Date.now();
        },
        tick() {
          const cfg = configStore.get();
          const now = Date.now();
          const dt = Math.max(0, Math.min(now - state.lastTickAt, 5 * MIN));
          state.lastTickAt = now;
          if (!cfg.enabled) {
            if (state.activeMs > 0 || state.due || state.restUntil || state.doneUntil) {
              resetCycle(cfg);
              state.restUntil = 0;
              state.doneUntil = 0;
            }
          } else if (state.restUntil > 0) {
            if (now >= state.restUntil) {
              // 休息倒计时结束
              state.restUntil = 0;
              state.doneUntil = now + DONE_SHOW_MS;
              resetCycle(cfg);
              state.lastActiveAt = now;
            }
          } else {
            if (state.intervalMin !== cfg.intervalMin) {
              // 间隔被改过：按新间隔重新计算下一次提醒点
              state.intervalMin = cfg.intervalMin;
              state.nextRemindMs = cfg.intervalMin * MIN;
            }
            if (now - state.lastActiveAt >= cfg.breakMin * MIN) {
              // 空闲足够久 = 已经休息过
              if (state.activeMs > 0 || state.due) resetCycle(cfg);
            } else {
              addUsage(now, dt); // 今日累计使用时长（不受工作时段限制）
              if (inWorkHours(cfg, now)) {
                state.activeMs += dt;
                if (!state.due && state.activeMs >= state.nextRemindMs) state.due = true;
              }
              // 非工作时段：只统计使用时长，不计提醒、不弹窗
            }
          }
          persist();
          publish();
        },
        startRest() {
          startRest(configStore.get().restMin * MIN);
          persist();
          publish();
        },
        extendRest() {
          if (state.restUntil > Date.now()) {
            state.restUntil += MIN;
            state.restTotalMs += MIN;
            persist();
            publish();
          }
        },
        endRest() {
          // 提前结束：直接回到工作状态，不弹“休息结束”
          state.restUntil = 0;
          state.doneUntil = 0;
          resetCycle(configStore.get());
          state.lastActiveAt = Date.now();
          persist();
          publish();
        },
        dismissDone() {
          state.doneUntil = 0;
          persist();
          publish();
        },
        snooze() {
          state.due = false;
          state.nextRemindMs = state.activeMs + configStore.get().snoozeMin * MIN;
          persist();
          publish();
        },
        preview() {
          state.restUntil = 0;
          state.doneUntil = 0;
          state.due = true;
          if (state.activeMs < MIN) state.activeMs = MIN;
          persist();
          publish();
        },
        refresh: publish,
      };
    }
    const store = createStore();

    // ---------- hooks ----------
    function useObservable(sub, get) {
      if (React.useSyncExternalStore) return React.useSyncExternalStore(sub, get);
      const [, force] = React.useState(0);
      React.useEffect(() => sub(() => force((n) => n + 1)), []);
      return get();
    }
    const useTiming = () => useObservable(store.subscribe, store.getSnapshot);
    const useConfig = () => useObservable(configStore.subscribe, configStore.get);
    const useLocale = () => useObservable(localeBus.subscribe, localeBus.version);

    // ---------- styles ----------
    const POPUP_CSS = `
.rr-card{position:fixed;right:20px;bottom:20px;z-index:2000;width:320px;box-sizing:border-box;
  padding:14px 16px;border-radius:14px;pointer-events:auto;
  background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);
  border:1px solid var(--dsw-alias-border-l2);box-shadow:0 8px 28px rgba(0,0,0,.22);
  font-size:13px;line-height:1.5;animation:rr-in .25s ease-out}
.rr-head{display:flex;align-items:center;gap:8px;font-weight:600;font-size:14px}
.rr-dot{width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-state-warn-primary)}
.rr-dot[data-tone="rest"]{background:var(--dsw-alias-brand-primary)}
.rr-dot[data-tone="done"]{background:var(--dsw-alias-state-success-primary)}
.rr-body{margin:6px 0 12px;color:var(--dsw-alias-label-secondary)}
.rr-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
.rr-btn{cursor:pointer;font:inherit;padding:5px 12px;border-radius:8px;
  border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.rr-btn:hover{background:var(--dsw-alias-bg-layer-2)}
.rr-btn:disabled{opacity:.5;cursor:default}
.rr-btn[data-primary]{background:var(--dsw-alias-brand-primary);border-color:transparent;color:var(--dsw-alias-bg-base)}
.rr-btn[data-primary]:hover{filter:brightness(1.08)}
.rr-btn[data-small]{padding:3px 10px;font-size:12px}
.rr-rest{display:flex;align-items:center;gap:16px;margin:10px 0 12px}
.rr-ring{position:relative;width:76px;height:76px;flex:none}
.rr-ring svg{display:block;transform:rotate(-90deg)}
.rr-ring-track{stroke:var(--dsw-alias-border-l2)}
.rr-ring-bar{stroke:var(--dsw-alias-brand-primary);stroke-linecap:round;transition:stroke-dashoffset .9s linear}
.rr-ring-time{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:17px;font-weight:600;font-variant-numeric:tabular-nums}
.rr-rest-text{min-width:0;color:var(--dsw-alias-label-secondary)}
.rr-rest-sub{color:var(--dsw-alias-label-primary);font-weight:500;margin-bottom:2px}
@keyframes rr-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
`;
    const SETTINGS_CSS = `
.rr-set{display:flex;flex-direction:column;gap:16px;padding:8px 0 24px;max-width:640px;
  color:var(--dsw-alias-label-primary);font-size:13px}
.rr-set h2{margin:0;font-size:18px;font-weight:600}
.rr-set-desc{margin-top:2px;color:var(--dsw-alias-label-secondary);font-size:12px}
.rr-sec{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary);margin:4px 0 -8px}
.rr-panel{display:flex;flex-direction:column;border-radius:12px;overflow:hidden;
  background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1)}
.rr-line{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 14px}
.rr-line + .rr-line{border-top:1px solid var(--dsw-alias-border-l1)}
.rr-line-text{min-width:0}
.rr-line-hint{color:var(--dsw-alias-label-secondary);font-size:12px;margin-top:1px}
.rr-ctrl{display:flex;align-items:center;gap:8px;flex:none}
.rr-unit{color:var(--dsw-alias-label-secondary);font-size:12px}
.rr-input{width:68px;box-sizing:border-box;padding:4px 8px;border-radius:8px;font:inherit;text-align:right;
  background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2)}
.rr-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.rr-input:disabled{opacity:.5}
.rr-chips{display:flex;gap:6px}
.rr-chip{cursor:pointer;font:inherit;font-size:12px;padding:3px 9px;border-radius:999px;
  border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary)}
.rr-chip:hover{background:var(--dsw-alias-bg-layer-2)}
.rr-chip[aria-pressed="true"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.rr-chip:disabled{opacity:.5;cursor:default}
.rr-switch{position:relative;width:36px;height:20px;flex:none;border-radius:10px;border:none;cursor:pointer;padding:0;
  background:var(--dsw-alias-state-idle-primary);transition:background .15s}
.rr-switch:disabled{opacity:.5;cursor:default}
.rr-switch[aria-checked="true"]{background:var(--dsw-alias-brand-primary)}
.rr-switch::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-bg-base);transition:transform .15s}
.rr-switch[aria-checked="true"]::after{transform:translateX(16px)}
.rr-status{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 14px}
.rr-status-label{color:var(--dsw-alias-label-secondary);font-size:12px}
.rr-status-time{font-size:28px;font-weight:600;line-height:1.2;font-variant-numeric:tabular-nums}
.rr-status-time[data-tone="rest"]{color:var(--dsw-alias-brand-primary)}
.rr-status-time[data-tone="due"]{color:var(--dsw-alias-state-warn-primary)}
.rr-status-time[data-tone="off"]{color:var(--dsw-alias-label-secondary);font-size:18px}
.rr-status-actions{display:flex;gap:8px;flex:none}
.rr-foot{display:flex;justify-content:flex-end}
.rr-time{box-sizing:border-box;padding:4px 8px;border-radius:8px;font:inherit;
  background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2)}
.rr-time:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.rr-time:disabled{opacity:.5}
.rr-usage{padding:14px}
.rr-usage-top{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.rr-usage-num{font-size:22px;font-weight:600}
.rr-bars{display:flex;align-items:flex-end;gap:8px;height:84px;margin-top:12px}
.rr-bar{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;height:100%;
  font-size:11px;color:var(--dsw-alias-label-secondary)}
.rr-bar-fill{width:100%;max-width:28px;min-height:2px;border-radius:4px 4px 0 0;background:var(--dsw-alias-border-l2)}
.rr-bar[data-today="true"] .rr-bar-fill{background:var(--dsw-alias-brand-primary)}
.rr-bar-val{font-variant-numeric:tabular-nums}
`;

    // ---------- popup ----------
    function RestRing(props) {
      const r = 33;
      const c = 2 * Math.PI * r;
      const ratio = props.total > 0 ? Math.min(1, Math.max(0, props.left / props.total)) : 0;
      return h(
        'div',
        { className: 'rr-ring' },
        h(
          'svg',
          { width: 76, height: 76, viewBox: '0 0 76 76', 'aria-hidden': 'true' },
          h('circle', { className: 'rr-ring-track', cx: 38, cy: 38, r, fill: 'none', strokeWidth: 5 }),
          h('circle', {
            className: 'rr-ring-bar',
            cx: 38,
            cy: 38,
            r,
            fill: 'none',
            strokeWidth: 5,
            strokeDasharray: c,
            strokeDashoffset: c * (1 - ratio),
          }),
        ),
        h('div', { className: 'rr-ring-time' }, fmt(props.left)),
      );
    }

    function RestReminder() {
      const snap = useTiming();
      const cfg = useConfig();
      useLocale();
      if (!cfg.enabled || snap.phase === 'work') return null;
      const t = T();
      const card = (tone, title, children) =>
        h(
          'div',
          { className: 'rr-card', role: 'alertdialog', 'aria-live': 'polite', 'aria-label': title },
          h('style', null, POPUP_CSS),
          h('div', { className: 'rr-head' }, h('span', { className: 'rr-dot', 'data-tone': tone }), title),
          children,
        );

      if (snap.phase === 'rest') {
        return card(
          'rest',
          t.restingTitle,
          h(
            React.Fragment,
            null,
            h(
              'div',
              { className: 'rr-rest' },
              h(RestRing, { left: snap.restLeft, total: snap.restTotal }),
              h(
                'div',
                { className: 'rr-rest-text' },
                h('div', { className: 'rr-rest-sub' }, t.restingSub),
                t.tips[snap.tip % t.tips.length],
              ),
            ),
            h(
              'div',
              { className: 'rr-actions' },
              h('button', { className: 'rr-btn', type: 'button', onClick: () => store.endRest() }, t.restEarly),
              h('button', { className: 'rr-btn', type: 'button', onClick: () => store.extendRest() }, t.restMore),
            ),
          ),
        );
      }

      if (snap.phase === 'done') {
        return card(
          'done',
          t.doneTitle,
          h(
            React.Fragment,
            null,
            h('div', { className: 'rr-body' }, t.doneBody),
            h(
              'div',
              { className: 'rr-actions' },
              h('button', { className: 'rr-btn', 'data-primary': 'true', type: 'button', onClick: () => store.dismissDone() }, t.doneOk),
            ),
          ),
        );
      }

      return card(
        'due',
        t.title,
        h(
          React.Fragment,
          null,
          h('div', { className: 'rr-body' }, t.body(Math.max(1, snap.minutes))),
          h(
            'div',
            { className: 'rr-actions' },
            h('button', { className: 'rr-btn', type: 'button', onClick: () => store.snooze() }, t.snooze(cfg.snoozeMin)),
            h('button', { className: 'rr-btn', 'data-primary': 'true', type: 'button', onClick: () => store.startRest() }, t.startRest(cfg.restMin)),
          ),
        ),
      );
    }

    // ---------- settings page ----------
    function NumberField(props) {
      const value = props.value;
      const [text, setText] = React.useState(String(value));
      React.useEffect(() => setText(String(value)), [value]);
      const commit = (raw) => {
        const n = Number(raw);
        if (raw !== '' && isFinite(n)) props.onCommit(n);
      };
      return h('input', {
        className: 'rr-input',
        type: 'number',
        min: LIMITS[props.name][0],
        max: LIMITS[props.name][1],
        step: 1,
        value: text,
        disabled: props.disabled,
        'aria-label': props.label,
        onChange: (e) => {
          setText(e.target.value);
          commit(e.target.value);
        },
        onBlur: () => setText(String(value)),
      });
    }

    function StatusPanel(props) {
      const { cfg, snap, t } = props;
      let tone = 'work';
      let label = t.statusWork;
      let value = fmt(snap.nextIn);
      let hint = t.statusUsed(snap.minutes);
      if (!cfg.enabled) {
        tone = 'off';
        label = t.statusOff;
        value = '—';
        hint = '';
      } else if (snap.phase === 'rest') {
        tone = 'rest';
        label = t.statusRest;
        value = fmt(snap.restLeft);
        hint = t.restingSub;
      } else if (snap.phase === 'due') {
        tone = 'due';
        label = t.statusDue;
        value = fmt(0);
      } else if (snap.phase === 'done') {
        tone = 'work';
        label = t.statusDone;
        value = '✓';
        hint = t.doneBody;
      } else if (snap.offHours) {
        tone = 'off';
        label = t.statusOffHours;
        value = '—';
        hint = '';
      }
      return h(
        'div',
        { className: 'rr-panel' },
        h(
          'div',
          { className: 'rr-status' },
          h(
            'div',
            null,
            h('div', { className: 'rr-status-label' }, label),
            h('div', { className: 'rr-status-time', 'data-tone': tone }, value),
            h('div', { className: 'rr-status-label' }, hint),
          ),
          h(
            'div',
            { className: 'rr-status-actions' },
            snap.phase === 'rest'
              ? h('button', { className: 'rr-btn', type: 'button', onClick: () => store.endRest() }, t.restEarly)
              : h('button', { className: 'rr-btn', type: 'button', disabled: !cfg.enabled, onClick: () => store.startRest() }, t.restNow),
            h('button', { className: 'rr-btn', type: 'button', disabled: !cfg.enabled, onClick: () => store.preview() }, t.preview),
          ),
        ),
      );
    }

    function UsagePanel(props) {
      const { snap, t } = props;
      const max = Math.max(60, ...snap.week.map((d) => d.min));
      return h(
        'div',
        { className: 'rr-panel rr-usage' },
        h(
          'div',
          { className: 'rr-usage-top' },
          h('div', null, h('div', { className: 'rr-status-label' }, t.today), h('div', { className: 'rr-usage-num' }, t.hm(snap.todayMin))),
          h('div', { className: 'rr-status-label' }, t.weekTitle),
        ),
        h(
          'div',
          { className: 'rr-bars' },
          snap.week.map((d, i) =>
            h(
              'div',
              { key: i, className: 'rr-bar', 'data-today': i === snap.week.length - 1 ? 'true' : 'false', title: t.hm(d.min) },
              h('span', { className: 'rr-bar-val' }, String(d.min)),
              h('div', { className: 'rr-bar-fill', style: { height: Math.round((d.min / max) * 52) + 'px' } }),
              h('span', null, t.weekdays[d.day]),
            ),
          ),
        ),
      );
    }

    function TimeField(props) {
      return h('input', {
        className: 'rr-time',
        type: 'time',
        value: props.value,
        disabled: props.disabled,
        'aria-label': props.label,
        onChange: (e) => {
          if (parseHM(e.target.value) !== null) props.onCommit(e.target.value);
        },
      });
    }

    function SettingsPage() {
      const cfg = useConfig();
      const snap = useTiming();
      useLocale();
      const t = T();
      const line = (title, hint, control) =>
        h(
          'div',
          { className: 'rr-line' },
          h('div', { className: 'rr-line-text' }, h('div', null, title), hint ? h('div', { className: 'rr-line-hint' }, hint) : null),
          control,
        );
      const num = (name, label) =>
        h(
          'div',
          { className: 'rr-ctrl' },
          h(NumberField, { name, label, value: cfg[name], disabled: !cfg.enabled, onCommit: (n) => configStore.set({ [name]: n }) }),
          h('span', { className: 'rr-unit' }, t.unit),
        );
      const presets = h(
        'div',
        { className: 'rr-chips' },
        PRESETS.map((m) =>
          h(
            'button',
            {
              key: m,
              className: 'rr-chip',
              type: 'button',
              disabled: !cfg.enabled,
              'aria-pressed': cfg.intervalMin === m ? 'true' : 'false',
              onClick: () => configStore.set({ intervalMin: m }),
            },
            String(m),
          ),
        ),
      );
      return h(
        'div',
        { className: 'rr-set' },
        h('style', null, SETTINGS_CSS),
        h('div', null, h('h2', null, t.setTitle), h('div', { className: 'rr-set-desc' }, t.setDesc)),
        h(StatusPanel, { cfg, snap, t }),
        h('div', { className: 'rr-sec' }, t.secUsage),
        h(UsagePanel, { snap, t }),
        h('div', { className: 'rr-sec' }, t.secRemind),
        h(
          'div',
          { className: 'rr-panel' },
          line(
            t.enabled,
            t.enabledHint,
            h('button', {
              className: 'rr-switch',
              type: 'button',
              role: 'switch',
              'aria-checked': cfg.enabled ? 'true' : 'false',
              'aria-label': t.enabled,
              onClick: () => configStore.set({ enabled: !cfg.enabled }),
            }),
          ),
          line(t.interval, t.intervalHint, h('div', { className: 'rr-ctrl' }, presets, num('intervalMin', t.interval))),
          line(t.rest, t.restHint, num('restMin', t.rest)),
        ),
        h('div', { className: 'rr-sec' }, t.secHours),
        h(
          'div',
          { className: 'rr-panel' },
          line(
            t.workOnly,
            t.workOnlyHint,
            h('button', {
              className: 'rr-switch',
              type: 'button',
              role: 'switch',
              'aria-checked': cfg.workOnly ? 'true' : 'false',
              'aria-label': t.workOnly,
              disabled: !cfg.enabled,
              onClick: () => configStore.set({ workOnly: !cfg.workOnly }),
            }),
          ),
          line(
            t.workRange,
            null,
            h(
              'div',
              { className: 'rr-ctrl' },
              h(TimeField, { label: t.workRange, value: cfg.workStart, disabled: !cfg.enabled || !cfg.workOnly, onCommit: (v) => configStore.set({ workStart: v }) }),
              h('span', { className: 'rr-unit' }, '—'),
              h(TimeField, { label: t.workRange, value: cfg.workEnd, disabled: !cfg.enabled || !cfg.workOnly, onCommit: (v) => configStore.set({ workEnd: v }) }),
            ),
          ),
          line(
            t.workdaysOnly,
            t.workdaysOnlyHint,
            h('button', {
              className: 'rr-switch',
              type: 'button',
              role: 'switch',
              'aria-checked': cfg.workdaysOnly ? 'true' : 'false',
              'aria-label': t.workdaysOnly,
              disabled: !cfg.enabled || !cfg.workOnly,
              onClick: () => configStore.set({ workdaysOnly: !cfg.workdaysOnly }),
            }),
          ),
        ),
        h('div', { className: 'rr-sec' }, t.secAdvanced),
        h(
          'div',
          { className: 'rr-panel' },
          line(t.brk, t.brkHint, num('breakMin', t.brk)),
          line(t.snoozeLabel, t.snoozeHint, num('snoozeMin', t.snoozeLabel)),
        ),
        h('div', { className: 'rr-foot' }, h('button', { className: 'rr-btn', type: 'button', onClick: () => configStore.reset() }, t.reset)),
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        // 记录用户输入，仅用于判断是否空闲，不读取任何内容
        const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];
        const onInput = () => store.touch();
        ctx.effect(() => {
          events.forEach((e) => window.addEventListener(e, onInput, { passive: true, capture: true }));
          return () => events.forEach((e) => window.removeEventListener(e, onInput, { capture: true }));
        });
        ctx.effect(() => {
          const id = window.setInterval(() => store.tick(), TICK_MS);
          return () => window.clearInterval(id);
        });
        // 配置变化后立刻刷新倒计时显示
        ctx.effect(() => configStore.subscribe(() => store.refresh()));
        // 多个标签页之间同步配置
        ctx.effect(() => {
          const onStorage = (e) => {
            if (e.key === CONFIG_KEY) configStore.reload();
          };
          window.addEventListener('storage', onStorage);
          return () => window.removeEventListener('storage', onStorage);
        });
        // 语言：读取当前语言，并在切换时刷新界面
        ctx.effect(() => {
          const locale = ctx.get && ctx.get('locale');
          if (!locale || !locale.getSnapshot) return undefined;
          localeBus.setGetter(() => locale.getSnapshot());
          localeBus.bump();
          const off = locale.subscribe ? locale.subscribe(() => localeBus.bump()) : undefined;
          return () => {
            if (off) off();
            localeBus.setGetter(null);
          };
        });
        // 各入口独立注册：任何一个失败都不影响其他入口
        const safe = (label, fn) => {
          try {
            fn();
          } catch (e) {
            console.error('[rest-reminder] ' + label + ' failed', e);
          }
        };
        // 到点提醒 / 休息倒计时的右下角浮层
        safe('overlay', () =>
          ctx.slots.inject('shell.overlay', () =>
            ctx.slots.register({ name: 'shell.overlay', id: 'rest-reminder', order: 90 }, RestReminder),
          ),
        );
        // 「设置」里独立的一页（与 dsh-builtin-browser 同一挂载点）
        safe('settings page', () =>
          ctx.slots.inject('settings.section', () =>
            ctx.slots.register(
              { name: 'settings.section', id: 'rest-reminder', order: 70, label: () => T().setTitle },
              SettingsPage,
            ),
          ),
        );
      },
    };
  },
});
