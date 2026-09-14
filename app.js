/*
 * 에셈고사 — 한 회차짜리 자가 검정.
 * 난이도 구분 없이 전 문항 풀에서 45문항을 뽑아 한 시험지로 출제한다.
 * 백엔드 없음. 진행 기록은 localStorage("kse:" prefix)에만 남는다.
 */
(function () {
  "use strict";

  // ── 상수 ────────────────────────────────────────────────

  var SUBJECTS = [
    "안전과 동의",
    "로프와 결박",
    "임팩트와 신체",
    "애프터케어와 심리",
    "용어와 커뮤니티",
    "성 건강과 도구",
  ];

  var CIRCLED = ["①", "②", "③", "④", "⑤"];
  var FILLED = ["❶", "❷", "❸", "❹", "❺"];

  // 배점은 원본 정답지를 따른다. hard가 붙은 문항이 3점, 나머지가 2점이다.
  function pointsOf(q) {
    return q.hard ? 3 : 2;
  }

  var PREFIX = "kse:";
  var KEY_ADULT = PREFIX + "adult";
  var KEY_BEST = PREFIX + "best";
  var KEY_NAME = PREFIX + "name";
  var KEY_HISTORY = PREFIX + "history";
  var HISTORY_MAX = 20;

  // 시험 연도. 표지·문제지·답안지·성적표가 이 한 곳을 본다.
  var EXAM_YEAR = "2027";

  // 표지의 필적 확인 문구. 공백을 무시하고 맞춰 본다.
  var PHRASE = "나를 강아지처럼 길들여줘";

  // 등급 컷 (백분율 하한)
  var GRADE_CUTS = [96, 90, 83, 75, 66, 56, 45, 33];

  var GRADE_COMMENT = {
    1: "전 범위에서 안정적입니다. 더 볼 것이 없습니다.",
    2: "대체로 정확합니다. 틀린 문항의 해설만 한 번 더 읽어 두십시오.",
    3: "기본은 잡혀 있습니다. 헷갈린 개념을 오답 노트에서 확인하십시오.",
    4: "아는 것과 헷갈리는 것이 섞여 있습니다. 오답만 다시 풀어 보십시오.",
    5: "절반쯤 맞혔습니다. 해설을 읽고 다시 응시하면 금방 올라갑니다.",
    6: "개념이 아직 정리되지 않았습니다. 해설부터 차분히 읽으십시오.",
    7: "기본 용어와 금기부터 다시 보는 편이 빠릅니다.",
    8: "찍은 것과 아는 것이 구분되지 않는 점수입니다. 해설을 정독하십시오.",
    9: "처음부터 보는 편이 낫습니다. 해설이 곧 교재입니다.",
  };

  // ── 저장소 ──────────────────────────────────────────────

  function store() {
    try {
      return window.localStorage;
    } catch (e) {
      return null; // 사생활 보호 모드 등
    }
  }

  function readKey(k) {
    var s = store();
    try {
      return s ? s.getItem(k) : null;
    } catch (e) {
      return null;
    }
  }

  function writeKey(k, v) {
    var s = store();
    try {
      if (s) s.setItem(k, v);
    } catch (e) {
      /* 저장에 실패해도 응시 자체는 막지 않는다 */
    }
  }

  // ── 유틸 ────────────────────────────────────────────────

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function query(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (e) {
      return null;
    }
  }

  function toTop() {
    try {
      window.scrollTo({ top: 0, behavior: "auto" });
    } catch (e) {
      window.scrollTo(0, 0);
    }
  }

  // ── 응시 기록 ───────────────────────────────────────────

  function readHistory() {
    var raw = readKey(KEY_HISTORY);
    if (!raw) return [];
    try {
      var list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function pushHistory(rec) {
    var list = readHistory();
    list.unshift(rec);
    writeKey(KEY_HISTORY, JSON.stringify(list.slice(0, HISTORY_MAX)));
  }

  function clearHistory() {
    writeKey(KEY_HISTORY, "[]");
    writeKey(KEY_BEST, "");
  }

  function fmtDate(ts) {
    var d = new Date(ts);
    function two(n) {
      return n < 10 ? "0" + n : String(n);
    }
    return (
      d.getFullYear() +
      "." +
      two(d.getMonth() + 1) +
      "." +
      two(d.getDate()) +
      " " +
      two(d.getHours()) +
      ":" +
      two(d.getMinutes())
    );
  }

  function gradeOf(pct) {
    for (var i = 0; i < GRADE_CUTS.length; i++) {
      if (pct >= GRADE_CUTS[i]) return i + 1;
    }
    return 9;
  }

  // ── 문항 풀 ─────────────────────────────────────────────

  // 2025 성향 영역(짝수형) 문항만 출제한다.
  // questions-safety.js의 안전 문항을 함께 내고 싶으면 아래 줄을
  // EXAM_QUESTIONS.concat(SAFETY_QUESTIONS) 로 바꾸고
  // index.html에서 그 스크립트를 다시 불러오면 된다.
  var POOL = EXAM_QUESTIONS;

  function paperSize() {
    var n = parseInt(query("n"), 10);
    if (isFinite(n) && n > 0) return Math.min(n, POOL.length);
    return POOL.length;
  }

  function fullMarks() {
    return POOL.reduce(function (sum, q) {
      return sum + pointsOf(q);
    }, 0);
  }

  /** 문항 순서와 보기 순서를 섞어 한 회차를 만든다. */
  function buildPaper(source, size) {
    return shuffle(source)
      .slice(0, size)
      .map(function (q) {
        var order = shuffle(
          q.options.map(function (_, i) {
            return i;
          }),
        );
        return { q: q, order: order, points: pointsOf(q) };
      });
  }

  /** 복수 정답까지 포함한 정답 자리 */
  function correctSlots(it) {
    var originals = [it.q.answer].concat(it.q.alsoCorrect || []);
    return originals
      .map(function (o) {
        return it.order.indexOf(o);
      })
      .sort(function (a, b) {
        return a - b;
      });
  }

  function isCorrect(it, slot) {
    return slot !== null && correctSlots(it).indexOf(slot) !== -1;
  }

  function optionAt(it, slot) {
    return it.q.options[it.order[slot]];
  }

  // ── 상태 ────────────────────────────────────────────────

  var app = document.getElementById("app");
  var state = {
    view: readKey(KEY_ADULT) === "1" ? "home" : "gate",
    paper: null,
    index: 0,
    answers: [],
    retry: false,
    name: readKey(KEY_NAME) || "",
    examNo: String(Math.floor(10000000 + Math.random() * 89999999)),
  };

  function render() {
    if (state.view === "gate") return renderGate();
    if (state.view === "exam") return renderExam();
    if (state.view === "omr") return renderOmr();
    if (state.view === "report") return renderReport();
    return renderHome();
  }

  // ── 성인 확인 ───────────────────────────────────────────

  function renderGate() {
    app.innerHTML =
      '<div class="gate">' +
      '<h1 class="title">에셈고사</h1>' +
      '<div class="block">' +
      "<p>이 사이트는 BDSM 활동에서의 <strong>위험 인지와 판단</strong>을 스스로 점검하기 위한 자가 검정입니다. 실습 방법을 알려 주지 않으며, 전문 교육이나 의료 상담을 대체하지 않습니다.</p>" +
      "<ul>" +
      "<li>· 만 19세 이상만 이용할 수 있습니다.</li>" +
      "<li>· 응시 기록은 서버로 전송되지 않고 이 브라우저에만 남습니다.</li>" +
      "</ul>" +
      "</div>" +
      '<div class="actions">' +
      '<button class="btn" id="gate-ok">만 19세 이상이며 위 내용을 확인했습니다</button>' +
      '<a href="https://www.google.com">나가기</a>' +
      "</div>" +
      "</div>";

    document.getElementById("gate-ok").addEventListener("click", function () {
      writeKey(KEY_ADULT, "1");
      state.view = "home";
      render();
      toTop();
    });
  }

  // ── 홈 ──────────────────────────────────────────────────

  function norm(s) {
    return String(s).replace(/\s+/g, "");
  }

  /** 표지 아래에 붙는 내 응시 기록 */
  function historyBlock() {
    var list = readHistory();
    if (!list.length) return "";
    var best = list.reduce(function (a, b) {
      return b.pct > a.pct ? b : a;
    });
    return (
      '<div class="record">' +
      '<div class="record-head"><h2>내 응시 기록</h2>' +
      '<button class="btn-quiet" id="clear-history">기록 지우기</button></div>' +
      '<p class="record-best">최고 ' +
      best.earned +
      " / " +
      best.total +
      "점 · " +
      best.grade +
      "등급 · " +
      esc(fmtDate(best.t)) +
      "</p>" +
      "<ol>" +
      list
        .slice(0, 5)
        .map(function (h) {
          return (
            "<li><span>" +
            esc(fmtDate(h.t)) +
            "</span><span>" +
            h.earned +
            " / " +
            h.total +
            "점</span><span>" +
            h.grade +
            "등급</span></li>"
          );
        })
        .join("") +
      "</ol>" +
      (list.length > 5
        ? '<p class="record-more">최근 5회만 표시됩니다 (총 ' +
          list.length +
          "회)</p>"
        : "") +
      "</div>"
    );
  }

  /** 홈은 실제 문제지 표지를 그대로 옮긴 것이다. */
  function renderHome() {
    var best = parseInt(readKey(KEY_BEST), 10);
    var hasBest = isFinite(best);

    var notes = [
      "문제지의 해당란에 성명과 수험 번호를 정확히 쓰시오.",
      null, // 필적 확인란. 아래에서 따로 조립한다.
      "답안지의 해당란에 성명과 수험 번호를 쓰고, 또 수험 번호, 문형(홀수/짝수), 답을 정확히 표시하시오.",
      "문항에 따라 배점이 다릅니다. 3점 문항에는 점수가 표시되어 있습니다. 점수 표시가 없는 문항은 모두 2점입니다.",
    ];

    var notesHtml = notes
      .map(function (t) {
        if (t !== null) return "<li>" + esc(t) + "</li>";
        return (
          "<li>답안지의 필적 확인란에 다음의 문구를 정자로 기재하시오.(바지벗지마세요님들)" +
          '<p class="phrase">' +
          esc(PHRASE) +
          "</p>" +
          '<input class="line-input" id="f-phrase" type="text" autocomplete="off" ' +
          'aria-label="필적 확인란" placeholder="여기에 그대로 적으시오" />' +
          "</li>"
        );
      })
      .join("");

    app.innerHTML =
      '<div class="wrap screen cover">' +
      '<p class="cover-kicker">' +
      EXAM_YEAR +
      "학년도 에세머능력시험 문제지</p>" +
      '<h1 class="cover-area">무슨 영역하지</h1>' +
      '<div class="cover-fields">' +
      '<label class="field"><span>성명</span>' +
      '<input id="f-name" type="text" autocomplete="off" value="' +
      esc(state.name) +
      '" /></label>' +
      '<label class="field"><span>수험 번호</span>' +
      '<input id="f-no" type="text" inputmode="numeric" autocomplete="off" value="' +
      esc(state.examNo) +
      '" /></label>' +
      "</div>" +
      '<div class="cover-notice"><ul>' +
      notesHtml +
      "</ul></div>" +
      '<p class="cover-band">※ 시험이 시작되기 전까지 표지를 넘기지 마시오.</p>' +
      '<div class="cover-start">' +
      '<button class="btn" id="start" disabled>표지를 넘기고 시작하기</button>' +
      '<p class="cover-meta">' +
      POOL.length +
      "문항 · 만점 " +
      fullMarks() +
      "점 · 제한 시간 없음" +
      "</p>" +
      "</div>" +
      historyBlock() +
      '<p class="cover-sub">심심해서 19살때 만든거 다시 우렷어요</p>' +
      "</div>";

    var clearBtn = document.getElementById("clear-history");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (window.confirm("응시 기록을 모두 지울까요? 되돌릴 수 없습니다.")) {
          clearHistory();
          render();
        }
      });
    }

    var phrase = document.getElementById("f-phrase");
    var nameEl = document.getElementById("f-name");
    var noEl = document.getElementById("f-no");
    var startBtn = document.getElementById("start");

    function check() {
      var ok = norm(phrase.value) === norm(PHRASE);
      startBtn.disabled = !ok;
      phrase.classList.toggle("is-ok", ok);
    }
    phrase.addEventListener("input", check);
    check();

    startBtn.addEventListener("click", function () {
      state.name = nameEl.value.trim();
      state.examNo = noEl.value.trim() || state.examNo;
      if (state.name) writeKey(KEY_NAME, state.name);

      state.paper = buildPaper(POOL, paperSize());
      state.index = 0;
      state.answers = state.paper.map(function () {
        return null;
      });
      state.retry = false;
      state.view = "exam";
      render();
      toTop();
    });
  }

  // ── 시험지 머리말·꼬리말 ────────────────────────────────

  function sheetHead(form) {
    return (
      '<header class="sheet-head">' +
      '<div class="tags"><span class="tag-pill">BDSM</span><span class="tag-pill">' +
      esc(form) +
      "</span></div>" +
      '<p class="kicker">' +
      EXAM_YEAR +
      "학년도 에세머능력시험 문제지</p>" +
      '<h1 class="area">성 향 영 역</h1>' +
      '<div class="double-rule"><div></div></div>' +
      "</header>"
    );
  }

  function sheetFoot(mid, form) {
    return (
      '<footer class="sheet-foot">' +
      "<span>성향 영역</span>" +
      '<span class="mid">' +
      esc(mid) +
      "</span>" +
      '<span class="right">' +
      esc(form) +
      "</span>" +
      "</footer>"
    );
  }

  var SHEET_NOTICE =
    '<p class="sheet-notice">이 문제지는 안전 지식의 자가 점검용이며 실제 자격 시험이 아닙니다.</p>';

  // ── 시험 ────────────────────────────────────────────────

  /** 그림 문항의 삽화. 출처 표기는 원본 문제지에 있던 그대로 붙인다. */
  function figure(q, compact) {
    if (!q.image) return "";
    return (
      '<figure class="figure' +
      (compact ? " is-compact" : "") +
      '"><img src="' +
      esc(q.image) +
      '" alt="문항 삽화" loading="lazy" />' +
      (q.imageNote
        ? "<figcaption>" + esc(q.imageNote) + "</figcaption>"
        : "") +
      "</figure>"
    );
  }

  function totalPoints() {
    return state.paper.reduce(function (sum, it) {
      return sum + it.points;
    }, 0);
  }

  function earnedPoints() {
    return state.paper.reduce(function (sum, it, i) {
      return sum + (isCorrect(it, state.answers[i]) ? it.points : 0);
    }, 0);
  }

  function renderExam() {
    var it = state.paper[state.index];
    var picked = state.answers[state.index];
    var answered = picked !== null;
    var isLast = state.index === state.paper.length - 1;
    var form = state.retry ? "복습형" : "짝수형";

    // 실제 시험처럼 푸는 동안에는 채점하지 않는다. 답만 표시한다.
    var ticks = state.paper
      .map(function (t, i) {
        var cls =
          i === state.index
            ? "is-now"
            : state.answers[i] === null
              ? ""
              : "is-done";
        return '<span class="' + cls + '"></span>';
      })
      .join("");

    var opts = it.order
      .map(function (_, s) {
        var chosen = picked === s;
        return (
          '<li><button class="opt' +
          (chosen ? " is-picked" : "") +
          '" data-slot="' +
          s +
          '" aria-pressed="' +
          (chosen ? "true" : "false") +
          '"><span class="mark">' +
          (chosen ? FILLED[s] : CIRCLED[s]) +
          '</span><span class="body">' +
          esc(optionAt(it, s)) +
          "</span></button></li>"
        );
      })
      .join("");

    var html =
      '<div class="wrap screen">' +
      '<div class="sheet">' +
      sheetHead(form) +
      '<div class="sheet-info">' +
      "<span>문 항 " +
      (state.index + 1) +
      " / " +
      state.paper.length +
      "</span>" +
      "<span>이 문항 " +
      it.points +
      "점 · 만점 " +
      totalPoints() +
      "점</span>" +
      "</div>" +
      '<div class="ticks">' +
      ticks +
      "</div>" +
      (state.retry
        ? '<p class="muted-note">※ 복습 응시입니다. 기록에 반영되지 않습니다.</p>'
        : "") +
      '<article class="qbody">' +
      (it.q.passage
        ? '<div style="margin-bottom:20px"><p class="passage-label">※ 다음 글을 읽고 물음에 답하시오.</p><div class="passage">' +
          esc(it.q.passage) +
          "</div></div>"
        : "") +
      '<h2 class="qtext"><span class="qnum">' +
      (state.index + 1) +
      '.</span><span>' +
      esc(it.q.q) +
      '<span class="qpoint">[' +
      it.points +
      "점]</span></span></h2>" +
      (it.q.box
        ? '<div style="margin-top:16px"><div class="boxnote">' +
          esc(it.q.box) +
          "</div></div>"
        : "") +
      figure(it.q) +
      '<ul class="opts">' +
      opts +
      "</ul>" +
      "</article>" +
      sheetFoot("— " + (state.index + 1) + " —", form) +
      "</div>" +
      SHEET_NOTICE +
      '<div class="controls">' +
      '<button class="btn-quiet" id="quit">그만두고 나가기</button>' +
      '<div class="controls-right">' +
      '<button class="btn btn-ghost" id="prev"' +
      (state.index === 0 ? " disabled" : "") +
      ">이전 문항</button>" +
      '<button class="btn" id="next"' +
      (answered ? "" : " disabled") +
      ">" +
      (isLast ? "채점하기" : "다음 문항") +
      "</button>" +
      "</div>" +
      "</div>" +
      '<p class="hint">키보드: 1~' +
      it.order.length +
      " 보기 선택 · Enter 다음 · 채점은 마지막에 한 번에 합니다</p>" +
      "</div>";

    app.innerHTML = html;

    Array.prototype.forEach.call(
      app.querySelectorAll(".opt"),
      function (btn) {
        btn.addEventListener("click", function () {
          pick(parseInt(btn.getAttribute("data-slot"), 10));
        });
      },
    );

    document.getElementById("prev").addEventListener("click", back);

    document.getElementById("quit").addEventListener("click", function () {
      if (
        window.confirm(
          "지금 나가면 이번 응시 기록은 저장되지 않습니다. 나갈까요?",
        )
      ) {
        state.view = "home";
        render();
        toTop();
      }
    });

    var nextBtn = document.getElementById("next");
    nextBtn.addEventListener("click", advance);
    if (answered) nextBtn.focus();
  }

  // 채점 전이므로 답은 언제든 바꿀 수 있다.
  function pick(slot) {
    state.answers[state.index] = slot;
    render();
  }

  function back() {
    if (state.index === 0) return;
    state.index -= 1;
    render();
    toTop();
  }

  function advance() {
    if (state.answers[state.index] === null) return;
    if (state.index === state.paper.length - 1) {
      finish();
      return;
    }
    state.index += 1;
    render();
    toTop();
  }

  function finish() {
    if (!state.retry) {
      var earned = earnedPoints();
      var total = totalPoints();
      var pct = Math.round((earned / total) * 100);
      var best = parseInt(readKey(KEY_BEST), 10);
      if (!isFinite(best) || pct > best) writeKey(KEY_BEST, String(pct));
      pushHistory({
        t: Date.now(),
        name: state.name,
        earned: earned,
        total: total,
        pct: pct,
        grade: gradeOf(pct),
      });
    }
    // 채점 결과로 바로 넘기지 않고 답안지를 먼저 보여 준다.
    state.omrBack = false;
    state.view = "omr";
    render();
    toTop();
  }

  // ── 답안지(OMR) ────────────────────────────────────────

  function renderOmr() {
    var n = state.paper.length;
    var half = Math.ceil(n / 2);

    function rows(from, to) {
      var out = "";
      for (var i = from; i < to; i++) {
        var it = state.paper[i];
        var picked = state.answers[i];
        var bubbles = "";
        for (var s = 0; s < it.order.length; s++) {
          bubbles +=
            '<i class="bub' +
            (picked === s ? " is-marked" : "") +
            '">' +
            (s + 1) +
            "</i>";
        }
        // 4지선다 문항도 칸 수를 맞춰 답안지 모양을 유지한다.
        for (var k = it.order.length; k < 5; k++) {
          bubbles += '<i class="bub is-void">' + (k + 1) + "</i>";
        }
        out +=
          '<li><span class="no">' +
          (i + 1) +
          '</span><span class="bubbles">' +
          bubbles +
          "</span></li>";
      }
      return out;
    }

    var back = state.omrBack;

    app.innerHTML =
      '<div class="wrap screen">' +
      '<div class="omr' +
      (back ? "" : " is-scanning") +
      '">' +
      '<div class="omr-top">' +
      "<span>" +
      EXAM_YEAR +
      "학년도 에세머능력시험 답안지</span>" +
      '<span class="tag-pill">짝수형</span>' +
      "</div>" +
      '<div class="omr-fields">' +
      '<div class="omr-field"><span>성명</span><b>' +
      esc(state.name || "―") +
      "</b></div>" +
      '<div class="omr-field"><span>수험 번호</span><b>' +
      esc(state.examNo) +
      "</b></div>" +
      "</div>" +
      '<div class="omr-grid">' +
      '<ol class="omr-col">' +
      rows(0, half) +
      "</ol>" +
      '<ol class="omr-col">' +
      rows(half, n) +
      "</ol>" +
      "</div>" +
      '<div class="omr-scan" aria-hidden="true"></div>' +
      "</div>" +
      '<p class="omr-status" id="omr-status">' +
      (back ? "제출한 답안지입니다." : "답안지를 판독하고 있습니다…") +
      "</p>" +
      '<div class="cover-start">' +
      '<button class="btn" id="omr-go"' +
      (back ? "" : " disabled") +
      ">" +
      (back ? "성적표로 돌아가기" : "채점 결과 보기") +
      "</button>" +
      "</div>" +
      "</div>";

    var go = document.getElementById("omr-go");
    go.addEventListener("click", function () {
      state.view = "report";
      render();
      toTop();
    });

    if (back) return;

    // 판독이 끝나면 결과를 열어 준다.
    var reduce = false;
    try {
      reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      /* 무시 */
    }
    setTimeout(
      function () {
        var el = document.getElementById("omr-go");
        if (!el) return;
        el.disabled = false;
        el.focus();
        var st = document.getElementById("omr-status");
        if (st) st.textContent = "판독이 끝났습니다.";
        var card = app.querySelector(".omr");
        if (card) card.classList.remove("is-scanning");
      },
      reduce ? 0 : 2200,
    );
  }

  // 1~5로 보기 선택, Enter로 다음 문항
  document.addEventListener("keydown", function (e) {
    if (state.view !== "exam") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var it = state.paper[state.index];

    var n = parseInt(e.key, 10);
    if (isFinite(n) && n >= 1 && n <= it.order.length) {
      e.preventDefault();
      pick(n - 1);
      return;
    }
    if (state.answers[state.index] === null) return;
    if (e.key === "Enter") {
      // 포커스가 버튼에 있으면 버튼이 직접 처리하므로 중복 실행을 막는다.
      if (document.activeElement === document.getElementById("next")) return;
      e.preventDefault();
      advance();
    }
  });

  // ── 성적표 이미지 ───────────────────────────────────────

  function rule(g, x1, y, x2, w) {
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x1, y);
    g.lineTo(x2, y);
    g.stroke();
  }

  /** 트위터에 올리기 좋은 정사각 성적표를 그린다. */
  function drawCard(r) {
    var W = 1000;
    var c = document.createElement("canvas");
    c.width = W;
    c.height = W;
    var g = c.getContext("2d");

    g.fillStyle = "#fff";
    g.fillRect(0, 0, W, W);
    g.strokeStyle = "#1c1a19";
    g.fillStyle = "#1c1a19";
    g.lineWidth = 2;
    g.strokeRect(40, 40, W - 80, W - 80);
    g.textAlign = "center";

    g.font = "700 24px Pretendard, sans-serif";
    g.fillText(EXAM_YEAR + "학년도 에세머능력시험 성적표", W / 2, 142);

    // 자간은 지원하는 브라우저에서만 준다.
    try {
      g.letterSpacing = "18px";
    } catch (e) {
      /* 무시 */
    }
    g.font = "700 60px 'Gowun Batang', serif";
    g.fillText("성 향 영 역", W / 2 + 9, 228);
    try {
      g.letterSpacing = "0px";
    } catch (e) {
      /* 무시 */
    }

    rule(g, 120, 266, W - 120, 3);
    rule(g, 120, 274, W - 120, 1);

    g.font = "400 22px Pretendard, sans-serif";
    g.textAlign = "left";
    g.fillText("성명  " + (r.name || "―"), 128, 326);
    g.textAlign = "right";
    g.fillText("수험 번호  " + r.examNo, W - 128, 326);

    g.textAlign = "center";
    g.fillStyle = "#6a6663";
    g.font = "400 20px Pretendard, sans-serif";
    g.fillText("원점수", W / 2, 420);

    g.fillStyle = "#1c1a19";
    g.font = "700 128px 'Gowun Batang', serif";
    g.fillText(String(r.earned), W / 2, 540);
    g.fillStyle = "#6a6663";
    g.font = "400 22px Pretendard, sans-serif";
    g.fillText("만점 " + r.total + "점", W / 2, 580);

    // 등급 도장. 4등급까지는 채우고 5등급부터는 비운다.
    var bw = 230;
    var bh = 80;
    var bx = (W - bw) / 2;
    var by = 616;
    var low = r.grade >= 5;
    g.lineWidth = 3;
    g.strokeStyle = low ? "#8b8783" : "#1c1a19";
    if (!low) {
      g.fillStyle = "#1c1a19";
      g.fillRect(bx, by, bw, bh);
    }
    g.strokeRect(bx, by, bw, bh);
    g.fillStyle = low ? "#8b8783" : "#fff";
    g.font = "700 44px 'Gowun Batang', serif";
    g.fillText(r.grade + "등급", W / 2, by + 56);

    // 백분율 막대와 등급 컷
    var barX = 128;
    var barW = W - 256;
    var barY = 752;
    g.strokeStyle = "#1c1a19";
    g.lineWidth = 1;
    g.strokeRect(barX, barY, barW, 12);
    g.fillStyle = "#1c1a19";
    g.fillRect(barX, barY, (barW * r.pct) / 100, 12);
    GRADE_CUTS.forEach(function (cut) {
      var x = barX + (barW * cut) / 100;
      rule(g, x, barY - 5, x, 1);
      g.beginPath();
      g.moveTo(x, barY - 5);
      g.lineTo(x, barY + 17);
      g.stroke();
    });

    g.fillStyle = "#6a6663";
    g.font = "400 21px Pretendard, sans-serif";
    g.fillText(
      r.count + "문항 중 " + r.correct + "문항 정답 · 백분율 " + r.pct + "%",
      W / 2,
      812,
    );

    rule(g, 128, 868, W - 128, 1);
    g.fillStyle = "#1c1a19";
    g.font = "700 26px Pretendard, sans-serif";
    g.fillText("에셈고사", W / 2, 910);
    g.fillStyle = "#6a6663";
    g.font = "400 20px Pretendard, sans-serif";
    g.fillText(r.date, W / 2, 942);

    return c;
  }

  function saveCard(r) {
    function go() {
      var canvas = drawCard(r);
      canvas.toBlob(function (blob) {
        if (!blob) return;
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "에셈고사_성적표_" + r.earned + "점_" + r.grade + "등급.png";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 1000);
      }, "image/png");
    }
    // canvas는 document.fonts.ready만으로는 부족하다.
    // 쓸 자간·굵기를 정확히 지정해 미리 로드시켜야 명조가 적용된다.
    if (document.fonts && document.fonts.load) {
      var specs = [
        "700 60px 'Gowun Batang'",
        "700 128px 'Gowun Batang'",
        "700 44px 'Gowun Batang'",
        "700 24px Pretendard",
        "400 22px Pretendard",
      ];
      Promise.all(
        specs.map(function (s) {
          return document.fonts.load(s, "성향영역0123456789등급점").catch(
            function () {},
          );
        }),
      ).then(go, go);
    } else {
      go();
    }
  }

  function resultText(r) {
    return [
      EXAM_YEAR + "학년도 에세머능력시험 성향 영역",
      "원점수 " + r.earned + "/" + r.total + "점 · " + r.grade + "등급",
      r.count + "문항 중 " + r.correct + "문항 정답",
    ].join("\n");
  }

  function copyText(text, done) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () {
        fallback();
      });
      return;
    }
    fallback();

    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch (e) {
        /* 무시 */
      }
      ta.remove();
      done();
    }
  }

  // ── 성적표 ──────────────────────────────────────────────

  function renderReport() {
    var total = totalPoints();
    var earned = earnedPoints();
    var pct = Math.round((earned / total) * 100);
    var grade = gradeOf(pct);
    var form = state.retry ? "복습형" : "짝수형";

    var wrong = [];
    state.paper.forEach(function (it, i) {
      if (!isCorrect(it, state.answers[i]))
        wrong.push({ it: it, i: i, picked: state.answers[i] });
    });

    var right = [];
    state.paper.forEach(function (it, i) {
      if (isCorrect(it, state.answers[i]))
        right.push({ it: it, i: i, picked: state.answers[i] });
    });

    /** 문항 하나의 해설 블록. 맞힌 문항은 '내 답' 줄을 생략한다. */
    function noteItem(w, showMine) {
      var rightHtml = correctSlots(w.it)
        .map(function (s) {
          return FILLED[s] + " " + esc(optionAt(w.it, s));
        })
        .join("<br />");
      return (
        "<li>" +
        '<h3><span class="qnum">' +
        (w.i + 1) +
        '.</span><span>' +
        esc(w.it.q.q) +
        '<span class="subj">' +
        esc(SUBJECTS[w.it.q.subject] || "") +
        "</span></span></h3>" +
        (w.it.q.passage
          ? '<div class="indent"><div class="passage">' +
            esc(w.it.q.passage) +
            "</div></div>"
          : "") +
        (w.it.q.box
          ? '<div class="indent"><div class="boxnote">' +
            esc(w.it.q.box) +
            "</div></div>"
          : "") +
        (w.it.q.image
          ? '<div class="indent">' + figure(w.it.q, true) + "</div>"
          : "") +
        '<dl class="answers">' +
        (showMine
          ? '<div><dt>✕ 내 답</dt><dd class="mine">' +
            (w.picked === null
              ? "무응답"
              : CIRCLED[w.picked] + " " + esc(optionAt(w.it, w.picked))) +
            "</dd></div>"
          : "") +
        '<div><dt>정답</dt><dd class="right">' +
        rightHtml +
        "</dd></div>" +
        "</dl>" +
        '<p class="explain-plain">' +
        esc(w.it.q.explain) +
        "</p>" +
        "</li>"
      );
    }

    var wrongHtml = wrong.length
      ? '<ol class="wrong-list">' +
        wrong
          .map(function (w) {
            return noteItem(w, true);
          })
          .join("") +
        "</ol>"
      : '<p style="padding:24px 0;font-family:var(--serif);color:var(--ink-soft)">틀린 문항이 없습니다.</p>';

    // 푸는 동안 해설을 보여주지 않으므로 맞힌 문항 해설도 볼 수 있게 둔다.
    var rightHtmlBlock = right.length
      ? '<div class="more-notes">' +
        '<button class="btn-quiet" id="show-right">맞힌 문항 해설도 보기 (' +
        right.length +
        "문항)</button>" +
        '<ol class="wrong-list" id="right-list" hidden>' +
        right
          .map(function (w) {
            return noteItem(w, false);
          })
          .join("") +
        "</ol></div>"
      : "";

    var cutMarks = GRADE_CUTS.map(function (c) {
      return '<b style="left:' + c + '%"></b>';
    }).join("");

    var html =
      '<div class="wrap screen">' +
      '<div class="sheet">' +
      sheetHead(form) +
      '<div class="sheet-info"><span>채점 결과' +
      (state.name ? " · " + esc(state.name) : "") +
      " · 수험번호 " +
      esc(state.examNo) +
      "</span><span>" +
      state.paper.length +
      "문항 · 만점 " +
      total +
      "점</span></div>" +
      '<div class="score-row">' +
      "<div>" +
      '<p class="score-label">원점수</p>' +
      '<p class="score-num">' +
      earned +
      "<small>점</small></p>" +
      "</div>" +
      '<p class="stamp' +
      (grade >= 5 ? " is-low" : "") +
      '">' +
      grade +
      "등급</p>" +
      "</div>" +
      '<div class="bar"><i style="width:' +
      pct +
      '%"></i>' +
      cutMarks +
      "</div>" +
      '<div class="bar-legend"><span>' +
      state.paper.length +
      "문항 중 " +
      (state.paper.length - wrong.length) +
      "문항 정답</span><span>백분율 " +
      pct +
      "%</span></div>" +
      '<p class="verdict">' +
      esc(GRADE_COMMENT[grade]) +
      "</p>" +
      (state.retry
        ? '<p class="muted-note">※ 이 응시는 기록에 반영되지 않습니다.</p>'
        : "") +
      '<h2 class="wrong-head">틀린 문항 · 해설<span>' +
      wrong.length +
      "문항</span></h2>" +
      wrongHtml +
      rightHtmlBlock +
      sheetFoot(earned + " / " + total, form) +
      "</div>" +
      SHEET_NOTICE +
      '<div class="end-buttons">' +
      '<button class="btn" id="save-card">성적표 이미지 저장</button>' +
      '<button class="btn btn-ghost" id="copy-result">결과 복사</button>' +
      "</div>" +
      '<div class="end-buttons">' +
      (wrong.length
        ? '<button class="btn btn-ghost" id="retry">틀린 문항만 다시 풀기</button>'
        : "") +
      '<button class="btn btn-ghost" id="omr-view">답안지 보기</button>' +
      '<button class="btn btn-ghost" id="home">처음 화면으로</button>' +
      "</div>" +
      "</div>";

    app.innerHTML = html;

    var card = {
      name: state.name,
      examNo: state.examNo,
      earned: earned,
      total: total,
      pct: pct,
      grade: grade,
      correct: state.paper.length - wrong.length,
      count: state.paper.length,
      date: fmtDate(Date.now()),
    };

    document.getElementById("save-card").addEventListener("click", function () {
      saveCard(card);
    });

    var copyBtn = document.getElementById("copy-result");
    copyBtn.addEventListener("click", function () {
      copyText(resultText(card), function () {
        copyBtn.textContent = "복사했습니다";
        setTimeout(function () {
          copyBtn.textContent = "결과 복사";
        }, 1600);
      });
    });

    if (wrong.length) {
      document.getElementById("retry").addEventListener("click", function () {
        var source = wrong.map(function (w) {
          return w.it.q;
        });
        state.paper = buildPaper(source, source.length);
        state.index = 0;
        state.answers = state.paper.map(function () {
          return null;
        });
        state.retry = true;
        state.view = "exam";
        render();
        toTop();
      });
    }

    var showRight = document.getElementById("show-right");
    if (showRight) {
      showRight.addEventListener("click", function () {
        var list = document.getElementById("right-list");
        list.hidden = !list.hidden;
        showRight.textContent = list.hidden
          ? "맞힌 문항 해설도 보기 (" + right.length + "문항)"
          : "맞힌 문항 해설 접기";
      });
    }

    document.getElementById("omr-view").addEventListener("click", function () {
      state.omrBack = true;
      state.view = "omr";
      render();
      toTop();
    });

    document.getElementById("home").addEventListener("click", function () {
      state.view = "home";
      render();
      toTop();
    });
  }

  // ── 시작 ────────────────────────────────────────────────

  render();
})();
