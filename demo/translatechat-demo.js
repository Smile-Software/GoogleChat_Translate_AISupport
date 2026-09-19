(() => {
  const UI = "data-tc-demo-ui";
  const translations = [
    "Chiều nay tôi sẽ nhờ Toyota kiểm tra. Vui lòng chờ một chút.",
    "Đang xử lý, có vấn đề. Hãy tham khảo Teams và xử lý giúp.",
    "Về việc này, đơn vị là cây. Hiện tại đang là g, vui lòng sửa lại.",
    "Tôi không thể xem hình ảnh.",
    "Vui lòng gửi email giúp tôi.",
    "Hôm nay cũng vui lòng gửi đơn trước 20 giờ."
  ];
  const knownTranslations = [
    ["午後にトヨタで確認してもらいます", "Chiều nay tôi sẽ nhờ Toyota kiểm tra. Vui lòng chờ một chút."],
    ["作業中 問題あり", "Đang xử lý nhưng có vấn đề. Vui lòng tham khảo Teams và hỗ trợ xử lý."],
    ["単位は本です", "Về việc này, đơn vị phải là cây. Hiện tại đang là g, vui lòng sửa lại."],
    ["私が画像を見ることが出来ません", "Tôi không thể xem hình ảnh."],
    ["メール送信ください", "Vui lòng gửi email giúp tôi."],
    ["本日も20時までの申請", "Hôm nay cũng vui lòng gửi đơn trước 20 giờ."],
    ["了解致しました", "Tôi đã hiểu."],
    ["今、稲森さんに送りました", "Tôi vừa gửi cho anh/chị Inamori."],
    ["豊田から確認終了の報告", "Toyota đã báo hoàn tất kiểm tra. Mọi thứ đều OK."],
    ["引き続きよろしくお願いいたします", "Mong mọi người tiếp tục phối hợp giúp tôi."],
    ["現時点で、トヨタからは", "Hiện tại Toyota đã đánh giá đạt yêu cầu, nên mọi người có thể yên tâm."],
    ["こちらこそよろしくお願いいたします", "Tôi cũng mong tiếp tục nhận được sự phối hợp của anh/chị."],
    ["まだ仕事中です", "Tôi vẫn đang làm việc."],
    ["家に帰りますので", "Tôi sẽ về nhà nên xin phép tạm rời cuộc trao đổi."],
    ["仕様からしても 未完了", "Xét theo đặc tả, công việc vẫn có thể được xem là chưa hoàn tất, đúng không?"],
    ["状況を理解いたしました", "Tôi đã hiểu tình hình. Chúng tôi sẽ ưu tiên xử lý các hạng mục quan trọng trước."],
    ["トヨタのプロジェクトが完成したら", "Khi dự án Toyota hoàn tất, sẽ còn nhiều công việc lớn đang chờ. Hiện tại chúng ta đang chuẩn bị."],
    ["残りについては", "Phần còn lại tôi chắc chắn sẽ xử lý sau. Tôi sẽ yêu cầu SKG hoàn tiền, việc này không ảnh hưởng đến công ty anh/chị."],
    ["先ほどの項目 追加の件", "Về mục bổ sung lúc nãy, vui lòng cho tôi xem bằng hình ảnh."],
    ["稲森さんが本日は作業が出来ません", "Hôm nay anh/chị Inamori không thể làm việc. Công việc sẽ chuyển sang thứ Hai."]
  ];
  const state = {
    newMessages: 0,
    summaryOpen: false,
    roomId: "AAQA47qiLo4",
    roomAllowlist: { AAQA47qiLo4: { label: "Chemmat 改修・運用連携" } }
  };

  const style = document.createElement("style");
  style.setAttribute(UI, "");
  style.textContent = `
    [${UI}] { font-family: Arial, sans-serif; }
    [data-tc-demo-bar] {
      position: fixed; z-index: 2147483640; top: 14px; right: 18px;
      display: flex; align-items: center; gap: 8px; padding: 8px 10px;
      background: #102a43; color: #fff; border-radius: 10px;
      box-shadow: 0 6px 24px #102a4340; font-size: 12px;
    }
    [data-tc-demo-bar] strong { color: #8ee3c8; letter-spacing: .04em; }
    [data-tc-demo-bar] button, [data-tc-demo-menu] button {
      border: 1px solid #8db7ac; border-radius: 7px; background: #fff;
      color: #174e46; padding: 5px 8px; cursor: pointer; font-size: 12px;
    }
    [data-tc-demo-bar] button { border-color: #467c72; background: #1c4d48; color: #fff; }
    [data-tc-demo-toolbar] { display: flex; gap: 5px; margin: 3px 0 2px 42px; position: relative; z-index: 3; }
    [data-tc-demo-toolbar] button {
      border: 1px solid #b8d8d1; border-radius: 999px; background: #f7fffd;
      color: #17665a; padding: 3px 8px; cursor: pointer; font-size: 11px;
    }
    [data-tc-demo-toolbar] button:hover { background: #e1f5ef; }
    [data-tc-demo-translation] {
      margin: 8px 0 0; padding: 8px 0 0;
      border-top: 1px solid #bfd8d1; color: #174e46;
      line-height: 1.45; font-size: 13px;
    }
    [data-tc-demo-translation] small { display: block; margin-bottom: 3px; color: #5b7a73; font-size: 10px; font-weight: 600; }
    [data-tc-demo-menu] {
      position: absolute; left: 74px; top: 26px; z-index: 12; min-width: 190px;
      padding: 5px; border: 1px solid #c5d4d0; border-radius: 8px;
      background: #fff; box-shadow: 0 8px 22px #203b3630;
    }
    [data-tc-demo-menu] button { display: block; width: 100%; text-align: left; border: 0; }
    [data-tc-demo-menu] button:hover { background: #edf8f4; }
    [data-tc-demo-summary] {
      position: fixed; z-index: 2147483639; top: 74px; right: 20px; width: 360px;
      max-height: 72vh; overflow: auto; padding: 16px; border: 1px solid #d7c992;
      border-radius: 14px; background: #fffdf4; color: #24352f;
      box-shadow: 0 14px 42px #17232b42;
    }
    [data-tc-demo-summary] h2 { margin: 0 0 5px; font-size: 17px; }
    [data-tc-demo-summary] p { white-space: pre-wrap; line-height: 1.55; font-size: 13px; }
    [data-tc-demo-summary] footer { display: flex; gap: 7px; margin-top: 14px; }
    [data-tc-demo-summary] button { border: 1px solid #d6c78f; border-radius: 7px; background: #fff; padding: 6px 9px; cursor: pointer; }
    [data-tc-demo-summary] [data-tc-demo-update] { background: #287d70; color: #fff; border-color: #287d70; }
    [data-tc-demo-stale] { display: block; margin: 8px 0; color: #8a6b1f; font-size: 12px; }
    @media (max-width: 720px) {
      [data-tc-demo-bar] { left: 10px; right: 10px; top: 10px; overflow-x: auto; white-space: nowrap; }
      [data-tc-demo-summary] { left: 12px; right: 12px; width: auto; }
    }
  `;
  document.documentElement.append(style);

  const demoBar = document.createElement("div");
  demoBar.setAttribute(UI, "");
  demoBar.setAttribute("data-tc-demo-bar", "");
  demoBar.innerHTML = "<strong>TranslateChat DEMO</strong><span data-tc-demo-count>Local only</span><button data-tc-demo-room>Dịch room: BẬT</button><button data-tc-demo-new>+ Message mới</button><button data-tc-demo-reset>Reset</button>";
  document.body.append(demoBar);

  function roomEnabled() {
    return Boolean(state.roomAllowlist[state.roomId]);
  }

  function updateRoomToggle() {
    const button = demoBar.querySelector("[data-tc-demo-room]");
    const enabled = roomEnabled();
    button.textContent = "Dịch room: " + (enabled ? "BẬT" : "TẮT");
    button.setAttribute("aria-pressed", String(enabled));
    demoBar.querySelector("[data-tc-demo-count]").textContent = enabled ? (state.newMessages ? state.newMessages + " message mới" : "Local only") : "Room đang tắt";
  }

  function clearRoomUi() {
    document.querySelectorAll("[data-tc-demo-translation], [data-tc-demo-menu], [data-tc-demo-toolbar]").forEach((node) => node.remove());
    document.querySelector("[data-tc-demo-summary]")?.remove();
    state.summaryOpen = false;
  }

  function enableRoomUi() {
    document.querySelectorAll('[data-message-id][jsname="oU6v8b"]').forEach(addControls);
  }

  function setRoomEnabled(enabled) {
    if (enabled) state.roomAllowlist[state.roomId] = { label: "Chemmat 改修・運用連携" };
    else delete state.roomAllowlist[state.roomId];
    clearRoomUi();
    updateRoomToggle();
    if (enabled) enableRoomUi();
  }

  function closeMenus() {
    document.querySelectorAll("[data-tc-demo-menu]").forEach((menu) => menu.remove());
  }

  function translateText(host, index) {
    const body = host.querySelector('[jsname="bgckF"], .DTp27d')
      || host.querySelector('[jsname="o7uNDd"]')
      || host.querySelector('.iKCcE');
    const source = body?.textContent || "";
    const match = knownTranslations.find(([needle]) => source.includes(needle));
    return match ? match[1] : translations[index % translations.length];
  }

  function showTranslation(host, index) {
    if (!host || !roomEnabled()) return;
    const body = host.querySelector('[jsname="bgckF"], .DTp27d')
      || host.querySelector('[jsname="o7uNDd"]')
      || host.querySelector('.iKCcE')
      || host;
    let output = body.querySelector("[data-tc-demo-translation]");
    if (!output) {
      output = document.createElement("div");
      output.setAttribute(UI, "");
      output.setAttribute("data-tc-demo-translation", "");
      body.append(output);
    }
    output.innerHTML = "<small>Bản dịch · vi</small>" + translateText(host, index);
    output.hidden = false;
  }

  function openSummary() {
    if (!roomEnabled()) return;
    closeMenus();
    state.summaryOpen = true;
    let card = document.querySelector("[data-tc-demo-summary]");
    if (!card) {
      card = document.createElement("section");
      card.setAttribute(UI, "");
      card.setAttribute("data-tc-demo-summary", "");
      card.innerHTML = "<h2>Thread summary</h2><div data-tc-demo-stale hidden></div><p data-tc-demo-summary-body></p><footer><button data-tc-demo-update>Cập nhật</button><button data-tc-demo-close>Đóng</button></footer>";
      document.body.append(card);
      card.querySelector("[data-tc-demo-close]").addEventListener("click", () => { card.remove(); state.summaryOpen = false; });
      card.querySelector("[data-tc-demo-update]").addEventListener("click", () => {
        state.newMessages = 0;
        card.querySelector("[data-tc-demo-stale]").hidden = true;
        card.querySelector("[data-tc-demo-summary-body]").textContent = "Đã cập nhật: thread vẫn đang theo dõi các hạng mục Toyota, Teams và phần việc còn lại.\n\nNext actions\n• Xác nhận phần server migration.\n• Chốt danh sách việc còn lại và effort.";
        demoBar.querySelector("[data-tc-demo-count]").textContent = "Summary up to date";
      });
    }
    card.querySelector("[data-tc-demo-summary-body]").textContent = "Thread đang trao đổi về tiến độ dự án, việc xác nhận với Toyota, các vấn đề cần tham khảo Teams và phần việc còn lại.\n\nDecisions\n• Ưu tiên xác nhận server migration.\n• Tách phần rà soát khỏi phần triển khai.\n\nNext actions\n• Gửi effort và timeline.\n• Cập nhật các hạng mục còn lại.";
    if (state.newMessages) {
      const stale = card.querySelector("[data-tc-demo-stale]");
      stale.textContent = "Có " + state.newMessages + " message mới";
      stale.hidden = false;
    }
  }

  function isMainMessage(marker) {
    return !marker.closest('[data-is-detailed-thread-view="true"]');
  }

  function addControls(marker, index) {
    if (!roomEnabled() || !isMainMessage(marker)) return;
    if (marker.closest("[data-tc-demo-toolbar]")) return;
    const host = marker.closest(".F0wyae") || marker.closest('[jsname="Ne3sFf"]');
    if (!host || host.querySelector("[data-tc-demo-toolbar]")) return;
    const body = host.querySelector('[jsname="bgckF"], .DTp27d, [jsname="o7uNDd"], .iKCcE');
    if (!body) return;
    const toolbar = document.createElement("div");
    toolbar.setAttribute(UI, "");
    toolbar.setAttribute("data-tc-demo-toolbar", "");
    toolbar.setAttribute("data-tc-demo-index", String(index));
    toolbar.innerHTML = "<button data-tc-demo-more aria-label=\"TranslateChat actions\">⋮</button>";
    body.after(toolbar);
    showTranslation(host, index);
  }

  document.querySelectorAll('[data-message-id][jsname="oU6v8b"]').forEach(addControls);
  updateRoomToggle();
  demoBar.querySelector("[data-tc-demo-room]").addEventListener("click", () => setRoomEnabled(!roomEnabled()));
  demoBar.querySelector("[data-tc-demo-new]").addEventListener("click", () => {
    state.newMessages += 1;
    if (!roomEnabled()) {
      updateRoomToggle();
      return;
    }
    demoBar.querySelector("[data-tc-demo-count]").textContent = state.newMessages + " message mới";
    const card = document.querySelector("[data-tc-demo-summary]");
    if (card) {
      const stale = card.querySelector("[data-tc-demo-stale]");
      stale.textContent = "Có " + state.newMessages + " message mới";
      stale.hidden = false;
    }
  });
  demoBar.querySelector("[data-tc-demo-reset]").addEventListener("click", () => {
    clearRoomUi();
    state.roomAllowlist = { AAQA47qiLo4: { label: "Chemmat 改修・運用連携" } };
    state.newMessages = 0;
    updateRoomToggle();
    enableRoomUi();
  });
  document.addEventListener("click", (event) => {
    const translate = event.target.closest("[data-tc-demo-translate]");
    if (translate) {
      const toolbar = translate.closest("[data-tc-demo-toolbar]");
      const host = toolbar?.closest(".F0wyae") || toolbar?.parentElement;
      showTranslation(host, Number(toolbar?.dataset.tcDemoIndex || 0));
      return;
    }
    const more = event.target.closest("[data-tc-demo-more]");
    if (more) {
      closeMenus();
      const toolbar = more.closest("[data-tc-demo-toolbar]");
      const menu = document.createElement("div");
      menu.setAttribute(UI, "");
      menu.setAttribute("data-tc-demo-menu", "");
      menu.innerHTML = "<button data-tc-demo-summary-action>Tóm tắt thread bằng AI</button>";
      const rect = more.getBoundingClientRect();
      menu.style.position = "fixed";
      menu.style.left = Math.round(rect.left) + "px";
      menu.style.top = Math.round(rect.bottom + 4) + "px";
      document.body.append(menu);
      menu.querySelector("button").addEventListener("click", openSummary);
      return;
    }
    if (!event.target.closest("[data-tc-demo-toolbar], [data-tc-demo-bar], [data-tc-demo-menu]")) closeMenus();
  });
})();
