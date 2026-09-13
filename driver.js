/* global */

const el = (id) => document.getElementById(id);

const TOKEN_KEY = "SIYMON_DRIVER_TOKEN";
let token = localStorage.getItem(TOKEN_KEY) || null;
let lang = localStorage.getItem("SIYMON_DRIVER_LANG") || "ar";
let me = null;
let currentTab = "mine"; // mine | available
let pollTimer = null;

const SOUND_KEY = "SIYMON_DRIVER_SOUND";
let soundEnabled = localStorage.getItem(SOUND_KEY) !== "0";
const ORDER_SOUND_URL = "/sounds/order.mp3";
let orderAudio = null;
let audioCtx = null;
let audioUnlocked = false;

function showSoundGate(msg) {
  const gate = el("soundGate");
  if (!gate) return;
  const t = el("soundGateText");
  if (t && msg) t.textContent = msg;
  gate.style.display = "flex";
}
function hideSoundGate() {
  const gate = el("soundGate");
  if (!gate) return;
  gate.style.display = "none";
}
let firstOrdersLoad = true;
let seenMineIds = new Set();
let seenAvailIds = new Set();

let newAlertActive = false;
let newAlertCount = 0;
const I18N = {
  ar: {
    dir: "rtl",
    brand: "بوابة السائق",
    subtitle: "استقبال الطلبات وتتبع التوصيل",
    authTitle: "تسجيل السائق",
    tabLogin: "دخول",
    tabSignup: "تسجيل",
    email: "البريد الإلكتروني",
    phone: "رقم الهاتف",
    name: "الاسم",
    cardNumber: "رقم البطاقة (اختياري)",
    password: "كلمة السر",
    confirmPassword: "تأكيد كلمة المرور",
    login: "دخول",
    signup: "تسجيل",
    loginHint: "يمكنك استعمال البريد الإلكتروني أو رقم الهاتف مع كلمة المرور.",
    imagesRequired: "الصور ضرورية للتسجيل.",
    dashTitle: "لوحة السائق",
    refresh: "تحديث",
    logout: "خروج",
    pendingTitle: "قيد الانتظار",
    pendingMsg: "حسابك قيد المراجعة. انتظر قبول المشرف ثم أعد التحديث.",
    refreshStatus: "تحديث الحالة",
    tabMine: "طلباتي",
    tabAvailable: "طلبات متاحة",
    mine: "طلباتي",
    available: "متاحة",
    deliveredCount: "تم توصيل",
    deliveredTotal: "مجموع ثمنهم",
    deliveredFeeNote: "مجموع التوصيل",
    earnToday: "أرباح اليوم",
    earnWeek: "أرباح الأسبوع",
    earnMonth: "أرباح الشهر",
    noOrders: "لا توجد طلبات هنا.",
    accept: "قبول",
    update: "تحديث",
    status: "الحالة",
    st_new: "جديد",
    st_accepted: "مقبول",
    st_picked_up: "تم الاستلام",
    st_on_the_way: "في الطريق",
    st_delivered: "تم التسليم",
    st_canceled: "ملغي",
    notApproved: "حسابك غير مقبول بعد.",
    okSaved: "تم ✅",
    errPwMismatch: "كلمتا السر غير متطابقتين",
    errNeedEmailPhone: "أدخل البريد الإلكتروني أو رقم الهاتف",
    openMaps: "فتح الخريطة",
    soundOn: "🔔 الصوت: تشغيل",
    soundOff: "🔕 الصوت: إيقاف",
    newOrder: "طلب جديد",
    markDelivered: "تم التسليم",
    markCanceled: "تم الإلغاء",
    addressLabel: "العنوان",
    totalLabel: "الإجمالي",
    callCustomer: "اتصال",
    chat: "دردشة",
    tabWallet: "المحفظة",
    tabProfile: "الملف الشخصي",
    profileTitle: "الملف الشخصي",
    profileRefresh: "تحديث",
    accountStatus: "حالة الحساب",
    createdAt: "تاريخ التسجيل",
    noProfilePhoto: "لا توجد صورة بروفايل",
    walletTitle: "المحفظة",
    balance: "الرصيد",
    bankAccount: "رقم الحساب البنكي",
    topup: "شحن المحفظة (Topup)",
    myTopups: "شحناتي",
    send: "إرسال",
    time: "الوقت",
    amount: "المبلغ",
    receipt: "الوصل",
    profilePhoto: "صورة بروفايل (اختياري)",
    errNeedProfilePhoto: "أضف صورة البروفايل.",
    insufficientBalance: "رصيد المحفظة غير كافي لقبول هذا الطلب.",
    noTopups: "لا توجد طلبات شحن",
    view: "عرض",
    notSet: "غير متوفر",
    enterName: "أدخل الاسم",
    customerPhoneNA: "❌ رقم الزبون غير متوفر",
    noMessagesYet: "لا توجد رسائل بعد",
    you: "أنت",
    customer: "الزبون",
    orderChatTitlePrefix: "دردشة الطلب #",
    typeMsg: "اكتب رسالة...",
    loginFirst: "قم بتسجيل الدخول أولاً.",
  },
  en: {
    dir: "ltr",
    brand: "Driver Portal",
    subtitle: "Receive orders and update delivery",
    authTitle: "Driver access",
    tabLogin: "Login",
    tabSignup: "Sign up",
    email: "Email",
    phone: "Phone",
    name: "Name",
    cardNumber: "Card Number",
    password: "Password",
    confirmPassword: "Confirm Password",
    login: "Login",
    signup: "Sign up",
    loginHint: "You can use Email OR Phone with password.",
    imagesRequired: "Images are required for signup.",
    dashTitle: "Driver Dashboard",
    refresh: "Refresh",
    logout: "Logout",
    pendingTitle: "Pending",
    pendingMsg:
      "Your account is pending review. Wait for admin approval then refresh.",
    refreshStatus: "Refresh status",
    tabMine: "My orders",
    tabAvailable: "Available",
    mine: "Mine",
    available: "Available",
    deliveredCount: "Delivered",
    deliveredTotal: "Total value",
    deliveredFeeNote: "Delivery fees",
    earnToday: "Today earnings",
    earnWeek: "Week earnings",
    earnMonth: "Month earnings",
    noOrders: "No orders here.",
    accept: "Accept",
    update: "Update",
    status: "Status",
    st_new: "New",
    st_accepted: "Accepted",
    st_picked_up: "Picked up",
    st_on_the_way: "On the way",
    st_delivered: "Delivered",
    st_canceled: "Canceled",
    notApproved: "Your account is not approved yet.",
    okSaved: "Saved ✅",
    errPwMismatch: "Passwords do not match",
    errNeedEmailPhone: "Enter Email or Phone",
    openMaps: "Open maps",
    soundOn: "🔔 Sound: ON",
    soundOff: "🔕 Sound: OFF",
    newOrder: "New order",
    markDelivered: "Delivered",
    markCanceled: "Canceled",
    addressLabel: "Address",
    totalLabel: "Total",
    callCustomer: "Call",
    chat: "Chat",
    tabWallet: "Wallet",
    tabProfile: "Profile",
    profileTitle: "My profile",
    profileRefresh: "Refresh",
    accountStatus: "Account status",
    createdAt: "Created",
    noProfilePhoto: "No profile photo",
    walletTitle: "Wallet",
    balance: "Balance",
    bankAccount: "Bank account",
    topup: "Topup",
    myTopups: "My topups",
    send: "Send",
    time: "Time",
    amount: "Amount",
    receipt: "Receipt",
    profilePhoto: "Profile photo",
    errNeedProfilePhoto: "Add a profile photo.",
    insufficientBalance: "Insufficient wallet balance to accept this order.",
    noTopups: "No topups",
    view: "View",
    notSet: "Not set",
    enterName: "Enter name",
    customerPhoneNA: "❌ Customer phone not available",
    noMessagesYet: "No messages yet",
    you: "You",
    customer: "Customer",
    orderChatTitlePrefix: "Order Chat #",
    typeMsg: "Type a message...",
    loginFirst: "Please login first.",
  },
  fr: {
    dir: "ltr",
    brand: "Portail Chauffeur",
    subtitle: "Recevoir les commandes et suivre la livraison",
    authTitle: "Accès chauffeur",
    tabLogin: "Connexion",
    tabSignup: "Inscription",
    email: "Email",
    phone: "Téléphone",
    name: "Nom",
    cardNumber: "N° de carte",
    password: "Mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    login: "Connexion",
    signup: "Inscription",
    loginHint: "Utilisez Email OU Téléphone avec le mot de passe.",
    imagesRequired: "Les images sont obligatoires.",
    dashTitle: "Tableau chauffeur",
    refresh: "Rafraîchir",
    logout: "Déconnexion",
    pendingTitle: "En attente",
    pendingMsg:
      "Compte en attente de validation. Attendez l’admin puis rafraîchissez.",
    refreshStatus: "Rafraîchir l’état",
    tabMine: "Mes commandes",
    tabAvailable: "Disponibles",
    mine: "Mes commandes",
    available: "Disponibles",
    deliveredCount: "Livrées",
    deliveredTotal: "Total",
    deliveredFeeNote: "Frais de livraison",
    earnToday: "Gains aujourd'hui",
    earnWeek: "Gains semaine",
    earnMonth: "Gains mois",
    noOrders: "Aucune commande ici.",
    accept: "Accepter",
    update: "Mettre à jour",
    status: "Statut",
    st_new: "Nouvelle",
    st_accepted: "Acceptée",
    st_picked_up: "Récupérée",
    st_on_the_way: "En route",
    st_delivered: "Livrée",
    st_canceled: "Annulée",
    notApproved: "Compte non validé.",
    okSaved: "Enregistré ✅",
    errPwMismatch: "Les mots de passe ne correspondent pas",
    errNeedEmailPhone: "Entrez Email ou Téléphone",
    openMaps: "Ouvrir la carte",
    soundOn: "🔔 Son: ON",
    soundOff: "🔕 Son: OFF",
    newOrder: "Nouvelle commande",
    markDelivered: "Livrée",
    markCanceled: "Annulée",
    addressLabel: "Adresse",
    totalLabel: "Total",
    callCustomer: "Appeler",
    chat: "Chat",
    tabWallet: "Portefeuille",
    tabProfile: "Profil",
    profileTitle: "Mon profil",
    profileRefresh: "Rafraîchir",
    accountStatus: "Statut du compte",
    createdAt: "Créé",
    noProfilePhoto: "Aucune photo de profil",
    walletTitle: "Portefeuille",
    balance: "Solde",
    bankAccount: "Compte bancaire",
    topup: "Recharger",
    myTopups: "Mes recharges",
    send: "Envoyer",
    time: "Heure",
    amount: "Montant",
    receipt: "Reçu",
    profilePhoto: "Photo de profil",
    errNeedProfilePhoto: "Ajoutez une photo de profil.",
    insufficientBalance: "Solde insuffisant pour accepter cette commande.",
    noTopups: "Aucune recharge",
    view: "Voir",
    notSet: "Non défini",
    enterName: "Entrez le nom",
    customerPhoneNA: "❌ Numéro du client indisponible",
    noMessagesYet: "Aucun message pour le moment",
    you: "Vous",
    customer: "Client",
    orderChatTitlePrefix: "Chat commande #",
    typeMsg: "Écrivez un message...",
    loginFirst: "Connectez-vous d'abord.",
  },
};

function t() {
  return I18N[lang] || I18N.en;
}

async function api(url, opts = {}) {
  const headers = Object.assign(
    { "Content-Type": "application/json" },
    opts.headers || {},
  );
  if (token) headers["X-Driver-Token"] = token;
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_e) {
    data = { error: text || "Error" };
  }
  if (!res.ok) {
    const err = new Error(data.error || "Request failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function setLang(next) {
  lang = next;
  localStorage.setItem("SIYMON_DRIVER_LANG", lang);
  applyI18n();
}

function setSound(enabled) {
  soundEnabled = !!enabled;
  localStorage.setItem(SOUND_KEY, soundEnabled ? "1" : "0");
  try {
    if (soundEnabled) unlockAudio();
  } catch (_e) {}
  applyI18n();
}

function unlockAudio() {
  if (!soundEnabled) return;
  try {
    if (!orderAudio) {
      orderAudio = new Audio(ORDER_SOUND_URL);
      orderAudio.preload = "auto";
    }

    try {
      if (!audioCtx)
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx && audioCtx.state === "suspended")
        audioCtx.resume().catch(() => {});
    } catch (_e) {}

    const prevVol = orderAudio.volume;
    orderAudio.volume = 0.001;
    orderAudio.muted = false;

    const p = orderAudio.play();
    if (p && p.then) {
      p.then(() => {
        audioUnlocked = true;
        hideSoundGate();
        try {
          orderAudio.pause();
          orderAudio.currentTime = 0;
        } catch (_e) {}
        orderAudio.volume = prevVol;
      }).catch(() => {
        orderAudio.volume = prevVol;
        audioUnlocked = false;
        showSoundGate();
      });
    } else {
      audioUnlocked = true;
      hideSoundGate();
      try {
        orderAudio.pause();
        orderAudio.currentTime = 0;
      } catch (_e) {}
      orderAudio.volume = prevVol;
    }
  } catch (_e) {
    audioUnlocked = false;
    showSoundGate();
  }
}

function playRingtone() {
  if (!soundEnabled) return;
  unlockAudio();
  try {
    if (!orderAudio) {
      orderAudio = new Audio(ORDER_SOUND_URL);
    }

    orderAudio.currentTime = 0;
    orderAudio.volume = 1.0;

    const playPromise = orderAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        try {
          if (!audioCtx)
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.type = "sine";
          o.frequency.value = 880;
          g.gain.value = 0.1;
          o.connect(g);
          g.connect(audioCtx.destination);
          o.start();
          setTimeout(() => {
            try {
              o.stop();
            } catch (_e) {}
          }, 250);
        } catch (_e) {}
      });
    }
    try {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } catch (_e) {}
  } catch (_e) {}
}

function applyI18n() {
  const tr = t();
  document.documentElement.lang = lang;
  document.documentElement.dir = tr.dir;

  el("driverBrand").textContent = tr.brand;
  el("driverSubtitle").textContent = tr.subtitle;
  el("authTitle").textContent = tr.authTitle;

  el("tabLogin").textContent = tr.tabLogin;
  el("tabSignup").textContent = tr.tabSignup;

  el("loginEmailLabel").textContent = tr.email;
  el("loginPhoneLabel").textContent = tr.phone;
  el("loginPassLabel").textContent = tr.password;
  el("loginText").textContent = tr.login;
  el("loginHint").textContent = tr.loginHint;

  el("signupEmailLabel").textContent = tr.email;
  el("signupPhoneLabel").textContent = tr.phone;
  el("signupNameLabel") &&
    (el("signupNameLabel").textContent = tr.name || "Name");
  el("signupCardLabel").textContent = tr.cardNumber;
  el("signupPassLabel").textContent = tr.password;
  el("signupPass2Label").textContent = tr.confirmPassword;
  el("signupText").textContent = tr.signup;

  el("dashTitle").textContent = tr.dashTitle;
  el("refreshOrdersBtn").textContent = tr.refresh;
  el("pendingTitle").textContent = tr.pendingTitle;
  el("pendingMsg").textContent = tr.pendingMsg;
  el("refreshStatusBtn").textContent = tr.refreshStatus;

  el("tabMine").textContent = tr.tabMine;
  el("tabAvailable").textContent = tr.tabAvailable;
  el("tabWallet") &&
    (el("tabWallet").textContent =
      tr.tabWallet ||
      (lang === "ar" ? "المحفظة" : lang === "fr" ? "Portefeuille" : "Wallet"));
  el("tabProfile") &&
    (el("tabProfile").textContent =
      tr.tabProfile ||
      (lang === "ar" ? "الملف الشخصي" : lang === "fr" ? "Profil" : "Profile"));
  el("walletTitle") &&
    (el("walletTitle").textContent =
      tr.walletTitle || (lang === "ar" ? "المحفظة" : "Wallet"));
  el("walletBalanceLabel") &&
    (el("walletBalanceLabel").textContent =
      tr.balance || (lang === "ar" ? "الرصيد" : "Balance"));
  el("bankAccountLabel") &&
    (el("bankAccountLabel").textContent =
      tr.bankAccount || (lang === "ar" ? "رقم الحساب البنكي" : "Bank account"));
  el("topupTitle") &&
    (el("topupTitle").textContent =
      tr.topup || (lang === "ar" ? "شحن المحفظة (Topup)" : "Topup"));
  el("topupsListTitle") &&
    (el("topupsListTitle").textContent =
      tr.myTopups || (lang === "ar" ? "شحناتي" : "My topups"));
  el("topupSendBtn") &&
    (el("topupSendBtn").textContent =
      tr.send || (lang === "ar" ? "إرسال" : "Send"));
  el("walletRefreshBtn") &&
    (el("walletRefreshBtn").textContent =
      tr.refresh || (lang === "ar" ? "تحديث" : "Refresh"));
  el("dTopTime") && (el("dTopTime").textContent = tr.time || "Time");
  el("dTopAmount") &&
    (el("dTopAmount").textContent =
      tr.amount || (lang === "ar" ? "المبلغ" : "Amount"));
  el("dTopStatus") &&
    (el("dTopStatus").textContent =
      tr.status || (lang === "ar" ? "الحالة" : "Status"));
  el("dTopReceipt") &&
    (el("dTopReceipt").textContent =
      tr.receipt || (lang === "ar" ? "الوصل" : "Receipt"));
  el("topupAmount") &&
    (el("topupAmount").placeholder =
      tr.amount || (lang === "ar" ? "المبلغ" : "Amount"));
  el("mineCountLabel").textContent = tr.mine;
  el("availCountLabel").textContent = tr.available;
  el("deliveredCountLabel") &&
    (el("deliveredCountLabel").textContent = tr.deliveredCount || "Delivered");
  el("deliveredTotalLabel") &&
    (el("deliveredTotalLabel").textContent = tr.deliveredTotal || "Total");
  el("earnTodayLabel") &&
    (el("earnTodayLabel").textContent =
      tr.earnToday || (lang === "ar" ? "أرباح اليوم" : "Today"));
  el("earnWeekLabel") &&
    (el("earnWeekLabel").textContent =
      tr.earnWeek || (lang === "ar" ? "أرباح الأسبوع" : "Week"));
  el("earnMonthLabel") &&
    (el("earnMonthLabel").textContent =
      tr.earnMonth || (lang === "ar" ? "أرباح الشهر" : "Month"));

  el("driverLogoutBtn").textContent = tr.logout;

  el("profilePhotoLabel") &&
    (el("profilePhotoLabel").textContent =
      tr.profilePhoto || (lang === "ar" ? "صورة بروفايل" : "Profile photo"));

  el("profileTitle") &&
    (el("profileTitle").textContent =
      tr.profileTitle ||
      (lang === "ar"
        ? "الملف الشخصي"
        : lang === "fr"
          ? "Mon profil"
          : "My profile"));
  el("profileRefreshBtn") &&
    (el("profileRefreshBtn").textContent =
      tr.profileRefresh ||
      tr.refresh ||
      (lang === "ar" ? "تحديث" : lang === "fr" ? "Rafraîchir" : "Refresh"));
  el("profileEmailLabel") &&
    (el("profileEmailLabel").textContent = tr.email || "Email");
  el("profilePhoneLabel") &&
    (el("profilePhoneLabel").textContent = tr.phone || "Phone");
  el("profileCardLabel") &&
    (el("profileCardLabel").textContent = tr.cardNumber || "Card Number");
  el("profileCreatedLabel") &&
    (el("profileCreatedLabel").textContent =
      tr.createdAt || (lang === "fr" ? "Créé" : "Created"));

  el("closeOrderChatBtn") &&
    (el("closeOrderChatBtn").textContent =
      tr.close ||
      (lang === "ar" ? "إغلاق" : lang === "fr" ? "Fermer" : "Close"));
  el("orderChatSendBtn") &&
    (el("orderChatSendBtn").textContent =
      tr.send ||
      (lang === "ar" ? "إرسال" : lang === "fr" ? "Envoyer" : "Send"));
  el("orderChatInput") &&
    (el("orderChatInput").placeholder =
      tr.typeMsg ||
      (lang === "ar"
        ? "اكتب رسالة..."
        : lang === "fr"
          ? "Écrivez un message..."
          : "Type a message..."));

  el("driverLangToggle").textContent =
    lang === "ar" ? "EN" : lang === "en" ? "FR" : "AR";
  const snd = el("driverSoundToggle");
  if (snd) snd.textContent = soundEnabled ? tr.soundOn : tr.soundOff;
}

function toNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function computeWalletChargeForOrder(order, cfg) {
  const enabled = cfg?.driverWalletEnabled !== false;
  if (!enabled) return 0;
  const mode = String(cfg?.driverWalletChargeMode || "subtotal").toLowerCase();
  if (mode === "commission")
    return Math.max(0, toNumber(cfg?.driverCommissionPerOrder));
  if (mode === "total") return Math.max(0, toNumber(order?.total));
  return Math.max(0, toNumber(order?.subtotal));
}

function computeReservedWallet(mineOrders, cfg) {
  const arr = Array.isArray(mineOrders) ? mineOrders : [];
  return arr
    .filter((o) => {
      const st = String(o?.status || "").toLowerCase();
      const done = ["delivered", "done", "canceled"].includes(st);
      const charged = !!(o?.walletChargedAt || o?.commissionChargedAt);
      return !done && !charged;
    })
    .reduce((sum, o) => sum + computeWalletChargeForOrder(o, cfg), 0);
}

async function getWalletSnapshot(cfg) {
  const balance = toNumber(me?.walletBalance);
  const reserved = computeReservedWallet(lastOrders?.mine, cfg);
  const available = balance - reserved;
  return { balance, reserved, available };
}

function setActiveAuthTab(which) {
  const loginTab = el("tabLogin");
  const signupTab = el("tabSignup");
  const loginForm = el("loginForm");
  const signupForm = el("signupForm");
  if (which === "signup") {
    signupTab.classList.add("active");
    loginTab.classList.remove("active");
    signupForm.style.display = "grid";
    loginForm.style.display = "none";
  } else {
    loginTab.classList.add("active");
    signupTab.classList.remove("active");
    loginForm.style.display = "grid";
    signupForm.style.display = "none";
  }
}

function setOrdersTab(which) {
  currentTab = which;
  el("tabMine").classList.toggle("active", which === "mine");
  el("tabAvailable").classList.toggle("active", which === "available");
  el("tabWallet") &&
    el("tabWallet").classList.toggle("active", which === "wallet");
  el("tabProfile") &&
    el("tabProfile").classList.toggle("active", which === "profile");

  const ordersList = el("ordersList");
  const ordersView = el("ordersView");
  const walletPanel = el("walletPanel");
  const profilePanel = el("profilePanel");

  if (ordersView)
    ordersView.style.display =
      which === "mine" || which === "available" ? "block" : "none";
  if (ordersList) ordersList.style.display = "block";
  if (walletPanel)
    walletPanel.style.display = which === "wallet" ? "block" : "none";
  if (profilePanel)
    profilePanel.style.display = which === "profile" ? "block" : "none";

  if (which === "wallet") {
    loadWallet().catch(() => {});
  } else if (which === "profile") {
    renderProfile();
  } else {
    renderOrders();
  }
}

function _readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsDataURL(file);
  });
}

async function fileToDataUrl(file, opts) {
  if (!file) return "";
  const o = opts || {};
  const maxDim = Number(o.maxDim || 0);
  const quality = Math.max(0.5, Math.min(0.95, Number(o.quality || 0.85)));

  const type = String(file.type || "");
  const isImg = type.startsWith("image/");
  if (!isImg) {
    return await _readFileAsDataUrl(file);
  }

  const needsResize = maxDim > 0;
  if (!needsResize && Number(file.size || 0) <= 1_500_000) {
    return await _readFileAsDataUrl(file);
  }

  const original = await _readFileAsDataUrl(file);
  const img = new Image();
  const loaded = await new Promise((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = original;
  });
  if (!loaded) {
    return original;
  }

  const w0 = img.naturalWidth || img.width || 0;
  const h0 = img.naturalHeight || img.height || 0;
  if (!w0 || !h0) return original;

  let w = w0,
    h = h0;
  if (maxDim > 0) {
    const m = Math.max(w0, h0);
    if (m > maxDim) {
      const s = maxDim / m;
      w = Math.max(1, Math.round(w0 * s));
      h = Math.max(1, Math.round(h0 * s));
    }
  }

  if (w === w0 && h === h0 && Number(file.size || 0) <= 1_500_000) {
    return original;
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return original;
  ctx.drawImage(img, 0, 0, w, h);

  try {
    return canvas.toDataURL("image/jpeg", quality);
  } catch (_e) {
    return original;
  }
}

function setPreview(inputId, imgId) {
  const input = el(inputId);
  const img = el(imgId);
  if (!input || !img) return;
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) {
      img.style.display = "none";
      img.src = "";
      return;
    }
    const url = await fileToDataUrl(file).catch(() => "");
    if (url) {
      img.src = url;
      img.style.display = "block";
    }
  });
}

function setLoggedInUI(isIn) {
  el("authCard").style.display = isIn ? "none" : "block";
  el("dashCard").style.display = isIn ? "block" : "none";
  el("driverLogoutBtn").style.display = isIn ? "inline-flex" : "none";
}

function statusLabel(st) {
  const tr = t();
  const key = `st_${String(st || "").toLowerCase()}`;
  return tr[key] || String(st || "");
}

function money(n) {
  const v = Number(n || 0);
  return `${v.toFixed(2)} MAD`;
}

function escapeHtml(s) {
  return String(s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}

function openMaps(addr, lat, lng) {
  if (lat && lng) {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
      "_blank",
    );
  } else if (
    addr &&
    (addr.startsWith("http://") || addr.startsWith("https://"))
  ) {
    window.open(addr, "_blank");
  } else {
    const q = encodeURIComponent(addr || "");
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${q}`,
      "_blank",
    );
  }
}

let lastOrders = { mine: [], available: [] };

let publicCfg = null;
let RESTAURANTS_CACHE = [];
async function loadPublicCfg() {
  if (publicCfg) return publicCfg;
  const res = await fetch("/api/public-config")
    .then((r) => r.json())
    .catch(() => ({}));
  publicCfg = res || {};
  return publicCfg;
}

function renderTopupsTable(topups) {
  const trn = t();
  const body = el("driverTopupsBody");
  if (!body) return;
  body.innerHTML = "";
  const list = Array.isArray(topups) ? topups : [];
  if (!list.length) {
    body.innerHTML = `<tr><td colspan="4" class="muted">${escapeHtml(trn.noTopups || "No topups")}</td></tr>`;
    return;
  }
  for (const tpu of list) {
    const row = document.createElement("tr");
    const viewBtn = tpu.receiptUrl
      ? `<button class="btn small" data-action="viewReceipt" data-url="${escapeHtml(tpu.receiptUrl)}">${escapeHtml(trn.view || "View")}</button>`
      : "";
    row.innerHTML = `<td>${escapeHtml(tpu.createdAt ? new Date(tpu.createdAt).toLocaleString() : "")}</td>
      <td>${escapeHtml(String(tpu.amount || ""))}</td>
      <td>${escapeHtml(String(tpu.status || ""))}</td>
      <td>${viewBtn}</td>`;
    body.appendChild(row);
  }
}

async function loadWallet() {
  if (!token) return;
  const trn = t();
  const cfg = await loadPublicCfg().catch(() => ({}));
  const bank = [cfg.bankAccountName, cfg.bankAccount]
    .filter(Boolean)
    .join("\n");
  el("bankAccountValue") &&
    (el("bankAccountValue").textContent = bank || trn.notSet || "Not set");
  const res = await api("/api/driver/wallet");
  el("walletBalance") &&
    (el("walletBalance").textContent = String(res.walletBalance ?? 0));
  renderTopupsTable(res.topups || []);
}

async function sendTopup() {
  const hint = el("topupHint");
  if (hint) hint.textContent = "";
  const amount = Number(el("topupAmount")?.value || 0);
  const file = el("topupReceipt")?.files?.[0];
  if (!amount || amount <= 0) {
    if (hint)
      hint.textContent =
        lang === "ar"
          ? "أدخل مبلغ صحيح."
          : lang === "fr"
            ? "Entrez un montant valide."
            : "Enter a valid amount.";
    return;
  }
  if (!file) {
    if (hint)
      hint.textContent =
        lang === "ar"
          ? "أضف صورة الوصل."
          : lang === "fr"
            ? "Ajoutez une image du reçu."
            : "Add a receipt image.";
    return;
  }
  const receipt = await fileToDataUrl(file);
  await api("/api/driver/topups", {
    method: "POST",
    body: JSON.stringify({ amount, receipt }),
  });
  if (hint)
    hint.textContent =
      lang === "ar"
        ? "تم إرسال طلب الشحن. في انتظار الموافقة."
        : lang === "fr"
          ? "Demande envoyée. En attente d'approbation."
          : "Sent. Waiting for approval.";
  el("topupAmount").value = "";
  el("topupReceipt").value = "";
  await loadWallet().catch(() => {});
}

function renderOrders() {
  const list = el("ordersList");
  if (!list) return;
  const tr = t();
  const arr = currentTab === "mine" ? lastOrders.mine : lastOrders.available;

  if (!arr.length) {
    list.innerHTML = `<div class="muted">${escapeHtml(tr.noOrders)}</div>`;
    return;
  }

  list.innerHTML = arr
    .map((o) => {
      const canAcceptBase =
        currentTab !== "mine" &&
        String(o.status || "") === "restaurant_ready" &&
        !o.driverId;
      const isMine = String(o.driverId || "") === String(me?.id || "");

      let canAccept = canAcceptBase;
      let walletWarn = "";
      if (canAcceptBase) {
        const cfg = publicCfg || {
          driverWalletEnabled: true,
          driverWalletChargeMode: "subtotal",
          driverCommissionPerOrder: 0,
        };
        const required = computeWalletChargeForOrder(o, cfg);
        const reserved = computeReservedWallet(lastOrders?.mine, cfg);
        const balance = toNumber(me?.walletBalance);
        const available = balance - reserved;
        if (required > available + 1e-9) {
          canAccept = false;
          walletWarn = tr.insufficientBalance || "Insufficient wallet";
        }
      }

      const st = String(o.status || "new");
      const statusSelect = isMine
        ? `
      <label class="muted" style="font-size:12px">${escapeHtml(tr.status)}</label>
      <select class="stSel" data-id="${escapeHtml(o.id)}">
        ${[
          "new",
          "accepted",
          "picked_up",
          "on_the_way",
          "delivered",
          "canceled",
        ]
          .map(
            (x) =>
              `<option value="${x}" ${x === st ? "selected" : ""}>${escapeHtml(statusLabel(x))}</option>`,
          )
          .join("")}
      </select>
    `
        : "";

      const rest =
        RESTAURANTS_CACHE.find(
          (r) => String(r.id) === String(o.restaurantId),
        ) || {};
      const restName = rest.name
        ? typeof rest.name === "string"
          ? rest.name
          : rest.name[lang] ||
            rest.name.ar ||
            rest.name.en ||
            rest.name.fr ||
            "المطعم"
        : "المطعم";

      const restAddr =
        "https://www.google.com/maps?q=33.2643604,-7.5717029&z=17&hl=en";

      return `
      <div class="order-card" data-oid="${escapeHtml(o.id)}">
        <div class="order-top">
          <div>
            <div class="order-id">#${escapeHtml(o.id)}</div>
            <div class="muted" style="font-size:12px">${escapeHtml(o.customer?.name || "")} — ${escapeHtml(o.customer?.phone || "")}</div>
          </div>
          <div class="order-status">${escapeHtml(statusLabel(st))}</div>
        </div>

        <div class="order-line" style="margin-bottom:6px; padding-bottom:6px; border-bottom:1px dashed #eee;">
          <span class="muted">${lang === "ar" ? "المطعم" : "Restaurant"}</span>
          <b>${escapeHtml(restName)}</b>
        </div>

        <div class="order-line"><span class="muted">${escapeHtml(tr.addressLabel || "Address")}</span><b>${escapeHtml(o.customer?.addr || "")}</b></div>
        <div class="order-line"><span class="muted">${escapeHtml(tr.totalLabel || "Total")}</span><b>${escapeHtml(money(o.total))}</b></div>

        <hr />

        <div class="order-actions">
          ${restAddr ? `<button class="btn ghost small" data-action="rest-map" data-addr="${escapeHtml(restAddr)}">📍 ${lang === "ar" ? "موقع المطعم" : "Rest. Map"}</button>` : ""}
          <button class="btn ghost small" data-action="maps" data-id="${escapeHtml(o.id)}">📍 ${lang === "ar" ? "موقع الزبون" : "Cust. Map"}</button>
          
          ${isMine ? `<button class="btn ghost small" data-action="call" data-id="${escapeHtml(o.id)}">${escapeHtml(tr.callCustomer || (lang === "ar" ? "اتصال" : "Call"))}</button>` : ""}
          ${isMine ? `<button class="btn ghost small" data-action="chat" data-id="${escapeHtml(o.id)}">${escapeHtml(tr.chat || (lang === "ar" ? "دردشة" : "Chat"))}</button>` : ""}
          ${canAccept ? `<button class="btn good small" data-action="accept" data-id="${escapeHtml(o.id)}">${escapeHtml(tr.accept)}</button>` : ""}
          ${
            isMine && ["picked_up", "on_the_way"].includes(st)
              ? `
            <button class="btn good small" data-action="delivered" data-id="${escapeHtml(o.id)}">${escapeHtml(tr.markDelivered)}</button>
            <button class="btn bad small" data-action="canceled" data-id="${escapeHtml(o.id)}">${escapeHtml(tr.markCanceled)}</button>
          `
              : ""
          }
        </div>

        ${walletWarn ? `<div class="hint" style="margin-top:8px">⚠️ ${escapeHtml(walletWarn)}</div>` : ""}

        ${statusSelect ? `<div style="margin-top:10px">${statusSelect}</div>` : ""}
      </div>
    `;
    })
    .join("");

  for (const sel of list.querySelectorAll(".stSel")) {
    sel.addEventListener("change", async () => {
      const id = sel.getAttribute("data-id");
      const st = sel.value;
      try {
        await api(`/api/driver/orders/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ status: st }),
        });
        newAlertActive = false;
        newAlertCount = 0;
        el("dashHint").textContent = t().okSaved;
        await loadOrders();
      } catch (e) {
        el("dashHint").textContent = `❌ ${e.message}`;
        await loadMe();
      }
    });
  }
}

function accountStatusLabel(st) {
  const s = String(st || "").toLowerCase();
  if (lang === "ar") {
    if (s === "approved") return "مقبول";
    if (s === "rejected") return "مرفوض";
    return "قيد المراجعة";
  }
  if (lang === "fr") {
    if (s === "approved") return "Validé";
    if (s === "rejected") return "Refusé";
    return "En attente";
  }
  if (s === "approved") return "Approved";
  if (s === "rejected") return "Rejected";
  return "Pending";
}

function renderProfile() {
  const panel = el("profilePanel");
  if (!panel) return;
  const tr = t();

  const img = el("driverProfileImg");
  const nameEl = el("driverProfileName");
  const contactEl = el("driverProfileContact");
  const statusEl = el("driverProfileStatus");
  const walletEl = el("driverProfileWalletTag");
  const hint = el("profileHint");

  if (!me) {
    if (hint)
      hint.textContent =
        lang === "ar"
          ? "قم بتسجيل الدخول أولاً."
          : lang === "fr"
            ? "Connectez-vous d'abord."
            : "Please login first.";
    return;
  }

  const photoUrl = me.profilePhotoUrl ? String(me.profilePhotoUrl) : "";
  if (img) {
    if (photoUrl) {
      img.src =
        photoUrl + (photoUrl.includes("?") ? "&" : "?") + "v=" + Date.now();
      img.classList.remove("placeholder");
      img.style.display = "block";
      img.style.cursor = "pointer";
      img.onclick = () => {
        try {
          window.open(photoUrl, "_blank");
        } catch (_e) {}
      };
    } else {
      img.src = "/icons/icon-192.png";
      img.classList.add("placeholder");
      img.style.display = "block";
      img.style.cursor = "default";
      img.onclick = null;
    }
  }

  if (nameEl) nameEl.textContent = me.name || "—";
  if (contactEl)
    contactEl.textContent = [me.phone, me.email].filter(Boolean).join(" • ");

  if (statusEl) {
    const s = String(me.status || "pending").toLowerCase();
    statusEl.textContent =
      (tr.accountStatus ? tr.accountStatus + ": " : "") + accountStatusLabel(s);
    statusEl.classList.remove("ok", "warn", "bad");
    if (s === "approved") statusEl.classList.add("ok");
    else if (s === "rejected") statusEl.classList.add("bad");
    else statusEl.classList.add("warn");
  }

  if (walletEl) {
    walletEl.textContent =
      (tr.balance ||
        (lang === "ar" ? "الرصيد" : lang === "fr" ? "Solde" : "Balance")) +
      ": " +
      String(me.walletBalance ?? 0);
  }

  el("profileEmail") && (el("profileEmail").textContent = me.email || "—");
  el("profilePhone") && (el("profilePhone").textContent = me.phone || "—");
  el("profileCard") && (el("profileCard").textContent = me.cardNumber || "—");
  try {
    const d = me.createdAt ? new Date(me.createdAt) : null;
    el("profileCreated") &&
      (el("profileCreated").textContent =
        d && !isNaN(d.getTime()) ? d.toLocaleString() : me.createdAt || "—");
  } catch (_e) {
    el("profileCreated") &&
      (el("profileCreated").textContent = me.createdAt || "—");
  }

  if (hint) {
    hint.textContent = photoUrl
      ? ""
      : "ℹ️ " +
        (tr.noProfilePhoto ||
          (lang === "ar"
            ? "لا توجد صورة بروفايل"
            : lang === "fr"
              ? "Aucune photo de profil"
              : "No profile photo"));
  }
}

async function loadMe() {
  if (!token) return null;
  const res = await api("/api/driver/me");
  me = res.driver;
  return me;
}

async function loadOrders(isPoll = false) {
  const tr = t();
  try {
    const res = await api("/api/driver/orders");
    const available = Array.isArray(res.available) ? res.available : [];
    const mine = Array.isArray(res.mine) ? res.mine : [];

    try {
      if (firstOrdersLoad) {
        seenMineIds = new Set(mine.map((o) => String(o.id)));
        seenAvailIds = new Set(available.map((o) => String(o.id)));
        firstOrdersLoad = false;
      } else {
        const newMine = mine.filter((o) => !seenMineIds.has(String(o.id)));
        const newAvail = available.filter(
          (o) =>
            !seenAvailIds.has(String(o.id)) &&
            String(o.status || "") === "restaurant_ready",
        );
        if (newMine.length + newAvail.length > 0) {
          playRingtone();
          const n = newMine.length + newAvail.length;
          newAlertActive = true;
          newAlertCount = n;
          const hint = el("dashHint");
          if (hint) hint.textContent = `${tr.newOrder} (${n})`;
        }
        seenMineIds = new Set(mine.map((o) => String(o.id)));
        seenAvailIds = new Set(available.map((o) => String(o.id)));
      }
    } catch (_e) {}

    lastOrders = { mine, available };
    el("mineCount").textContent = String(mine.length);
    el("availCount").textContent = String(available.length);
    try {
      const st = res.stats || null;
      const deliveredCount = st
        ? Number(st.deliveredCount || 0)
        : mine.filter((o) =>
            ["delivered", "done"].includes(String(o.status || "")),
          ).length;
      const deliveredTotal = st
        ? Number(st.deliveredTotal || 0)
        : mine
            .filter((o) =>
              ["delivered", "done"].includes(String(o.status || "")),
            )
            .reduce((s, o) => s + Number(o.total || 0), 0);
      const deliveredFee = st
        ? Number(st.deliveredDeliveryFee || 0)
        : mine
            .filter((o) =>
              ["delivered", "done"].includes(String(o.status || "")),
            )
            .reduce((s, o) => s + Number(o.deliveryFee || 0), 0);
      el("deliveredCount") &&
        (el("deliveredCount").textContent = String(deliveredCount));
      el("deliveredTotal") &&
        (el("deliveredTotal").textContent = money(deliveredTotal));
      const note = el("deliveredFeeNote");
      if (note) {
        const lbl = t()?.deliveredFeeNote || "Delivery fees";
        note.textContent = `${lbl}: ${money(deliveredFee)}`;
      }
      const s = res.stats || null;
      const todayFee = s ? Number(s.earningsToday || 0) : 0;
      const weekFee = s ? Number(s.earningsWeek || 0) : 0;
      const monthFee = s ? Number(s.earningsMonth || 0) : 0;
      el("earnToday") && (el("earnToday").textContent = money(todayFee));
      el("earnWeek") && (el("earnWeek").textContent = money(weekFee));
      el("earnMonth") && (el("earnMonth").textContent = money(monthFee));
    } catch (_e) {}

    renderOrders();

    if (!isPoll && !newAlertActive) el("dashHint").textContent = "";
  } catch (e) {
    if (e.status === 401) {
      token = null;
      localStorage.removeItem(TOKEN_KEY);
      setLoggedInUI(false);
      if (pollTimer) clearInterval(pollTimer);
      return;
    }
    if (e.status === 403) {
      el("pendingBox").style.display = "block";
      el("dashHint").textContent = tr.notApproved;
      return;
    }
    if (!isPoll) el("dashHint").textContent = `❌ ${e.message}`;
  }
}

async function refreshStatus() {
  const tr = t();
  try {
    await loadMe();
    if (String(me?.status || "pending") !== "approved") {
      el("pendingBox").style.display = "block";
      el("dashHint").textContent = tr.notApproved;
      return;
    }
    el("pendingBox").style.display = "none";
    el("dashHint").textContent = "";
    await loadOrders();
  } catch (e) {
    el("dashHint").textContent = `❌ ${e.message}`;
  }
}

async function onLoggedIn() {
  const tr = t();
  setLoggedInUI(true);
  await loadMe();
  try {
    await loadPublicCfg();
  } catch (_e) {}
  try {
    const rRes = await fetch("/api/restaurants").then((r) => r.json());
    RESTAURANTS_CACHE = rRes.restaurants || [];
  } catch (e) {}
  try {
    const w = await api("/api/driver/wallet");
    if (me) me.walletBalance = w.walletBalance;
  } catch (_e) {}
  el("dashSub").textContent =
    `${me?.name ? me.name + " • " : ""}${me?.email || ""} • ${me?.phone || ""} • ${me?.status || "pending"}`;

  try {
    renderProfile();
  } catch (_e) {}

  if (String(me?.status || "pending") !== "approved") {
    el("pendingBox").style.display = "block";
  } else {
    el("pendingBox").style.display = "none";
  }

  await loadOrders();
  if (pollTimer) clearInterval(pollTimer);

  pollTimer = setInterval(async () => {
    if (!token) return;
    try {
      const res = await api("/api/driver/me");
      me = res.driver;
      if (String(me?.status) === "approved") {
        el("pendingBox").style.display = "none";
      } else {
        el("pendingBox").style.display = "block";
      }
    } catch (e) {}
    loadOrders(true);
  }, 3000);
}

async function doLogin() {
  const tr = t();
  const email = String(el("loginEmail").value || "").trim();
  const phone = String(el("loginPhone").value || "").trim();
  const password = String(el("loginPassword").value || "");

  if (!email && !phone) {
    el("authHintLogin").textContent = `❌ ${tr.errNeedEmailPhone}`;
    return;
  }

  try {
    unlockAudio();
  } catch (_e) {}

  try {
    const res = await api("/api/driver/login", {
      method: "POST",
      body: JSON.stringify({ email, phone, password }),
    });
    token = res.token;
    localStorage.setItem(TOKEN_KEY, token);
    el("authHintLogin").textContent = "";
    await onLoggedIn();
  } catch (e) {
    el("authHintLogin").textContent = `❌ ${e.message}`;
  }
}

async function doSignup() {
  const tr = t();
  const btn = el("signupBtn");
  const setBusy = (busy, msg) => {
    try {
      if (btn) {
        btn.disabled = !!busy;
        if (!btn.getAttribute("data-label"))
          btn.setAttribute("data-label", btn.textContent || "");
        btn.textContent = busy
          ? (tr.signup || "Sign up") + "…"
          : btn.getAttribute("data-label") || tr.signup || "Sign up";
      }
    } catch (_e) {}
    if (typeof msg === "string") el("authHint").textContent = msg;
  };

  const email = String(el("signupEmail").value || "").trim();
  const phone = String(el("signupPhone").value || "").trim();
  const name = String(el("signupName")?.value || "").trim();
  const cardNumber = String(el("signupCardNumber").value || "").trim();
  const password = String(el("signupPassword").value || "");
  const password2 = String(el("signupPassword2").value || "");

  if (password2 !== password) {
    el("authHint").textContent = `❌ ${tr.errPwMismatch}`;
    return;
  }
  if (!name) {
    el("authHint").textContent = `❌ ${tr.enterName || "Enter name"}`;
    return;
  }

  const faceFile =
    el("faceWithBikeCard").files && el("faceWithBikeCard").files[0];
  const frontFile = el("idFront").files && el("idFront").files[0];
  const backFile = el("idBack").files && el("idBack").files[0];
  const profileFile = el("profilePhoto")?.files && el("profilePhoto")?.files[0];

  try {
    setBusy(true, "⏳ جاري تجهيز الصور…");
    const [profilePhoto, faceWithBikeCard, idFront, idBack] = await Promise.all(
      [
        fileToDataUrl(profileFile, { maxDim: 900, quality: 0.82 }),
        fileToDataUrl(faceFile, { maxDim: 1600, quality: 0.85 }),
        fileToDataUrl(frontFile, { maxDim: 1600, quality: 0.85 }),
        fileToDataUrl(backFile, { maxDim: 1600, quality: 0.85 }),
      ],
    );

    const payload = {
      name,
      phone,
      cardNumber,
      password,
      password2,
      profilePhoto,
      faceWithBikeCard,
      idFront,
      idBack,
    };
    if (email) payload.email = email;

    setBusy(true, "⏳ جاري إرسال البيانات…");
    const res = await api("/api/driver/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    token = res.token;
    localStorage.setItem(TOKEN_KEY, token);
    setBusy(true, "⏳ تم التسجيل، جاري تحميل حسابك…");
    await onLoggedIn();
    setBusy(false, "");
  } catch (e) {
    setBusy(false, `❌ ${e.message}`);
  }
}

function logout() {
  token = null;
  me = null;
  localStorage.removeItem(TOKEN_KEY);
  setLoggedInUI(false);
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  lastOrders = { mine: [], available: [] };
  firstOrdersLoad = true;
  seenMineIds = new Set();
  seenAvailIds = new Set();
  newAlertActive = false;
  newAlertCount = 0;
}

function bindEvents() {
  el("driverLangToggle").addEventListener("click", () => {
    const next = lang === "ar" ? "en" : lang === "en" ? "fr" : "ar";
    setLang(next);
  });
  el("driverSoundToggle")?.addEventListener("click", () => {
    setSound(!soundEnabled);
  });
  el("soundGateBtn")?.addEventListener("click", () => {
    try {
      setSound(true);
      playRingtone();
      hideSoundGate();
    } catch (_e) {}
  });

  el("tabLogin").addEventListener("click", () => setActiveAuthTab("login"));
  el("tabSignup").addEventListener("click", () => setActiveAuthTab("signup"));

  el("loginBtn").addEventListener("click", doLogin);
  el("signupBtn").addEventListener("click", doSignup);

  el("driverLogoutBtn").addEventListener("click", logout);

  el("refreshOrdersBtn").addEventListener("click", () => loadOrders());
  el("dashHint")?.addEventListener("click", () => {
    newAlertActive = false;
    newAlertCount = 0;
    el("dashHint").textContent = "";
  });
  el("refreshStatusBtn").addEventListener("click", refreshStatus);

  el("tabMine").addEventListener("click", () => setOrdersTab("mine"));
  el("tabAvailable").addEventListener("click", () => setOrdersTab("available"));
  el("tabWallet")?.addEventListener("click", () => setOrdersTab("wallet"));
  el("tabProfile")?.addEventListener("click", () => setOrdersTab("profile"));

  el("walletRefreshBtn")?.addEventListener("click", () =>
    loadWallet().catch(() => {}),
  );
  el("profileRefreshBtn")?.addEventListener("click", async () => {
    const h = el("profileHint");
    if (h) h.textContent = "";
    try {
      await loadMe();
      try {
        const w = await api("/api/driver/wallet");
        if (me) me.walletBalance = w.walletBalance;
      } catch (_e) {}
      renderProfile();
    } catch (e) {
      if (h) h.textContent = "❌ " + (e.message || e);
    }
  });

  // ======= أزرار الملف الشخصي الجديدة ======= //
  el("profileLogoutBtn")?.addEventListener("click", () => {
    const msg =
      lang === "ar"
        ? "هل تريد تسجيل الخروج؟"
        : lang === "fr"
          ? "Voulez-vous vous déconnecter ?"
          : "Are you sure you want to logout?";
    if (confirm(msg)) {
      logout();
    }
  });

  el("profileDeleteBtn")?.addEventListener("click", async () => {
    const msg =
      lang === "ar"
        ? "هل أنت متأكد من أنك تريد حذف حسابك نهائياً؟ لا يمكن التراجع عن هذه الخطوة."
        : lang === "fr"
          ? "Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible."
          : "Are you sure you want to permanently delete your account? This cannot be undone.";
    if (confirm(msg)) {
      try {
        // تأكد من وجود هذا الـ Route في ملف الخادم (server.js) ليقوم بحذف الحساب من الداتا بيز
        await api("/api/driver/me", { method: "DELETE" });
        alert(
          lang === "ar"
            ? "تم حذف الحساب بنجاح."
            : "Account deleted successfully.",
        );
        logout();
      } catch (e) {
        alert("❌ " + (e.message || e));
      }
    }
  });
  // =========================================== //

  el("topupSendBtn")?.addEventListener("click", () =>
    sendTopup().catch((err) => {
      el("topupHint").textContent = `❌ ${err.message}`;
    }),
  );
  el("driverTopupsBody")?.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.getAttribute("data-action") === "viewReceipt") {
      const url = b.getAttribute("data-url");
      if (url) window.open(url, "_blank");
    }
  });

  setPreview("profilePhoto", "prevProfile");
  setPreview("faceWithBikeCard", "prevFace");

  el("closeOrderChatBtn")?.addEventListener("click", () =>
    showOrderChat(false),
  );
  el("orderChatSendBtn")?.addEventListener("click", () =>
    sendOrderChat().catch(() => {}),
  );
  el("orderChatInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendOrderChat().catch(() => {});
    }
  });

  setPreview("idFront", "prevFront");
  setPreview("idBack", "prevBack");

  el("ordersList").addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    if (!action) return;

    if (action === "rest-map") {
      const addr = btn.getAttribute("data-addr");
      if (addr) openMaps(addr);
      return;
    }

    const id = btn.getAttribute("data-id");
    if (!id) return;

    const order =
      [...(lastOrders.mine || []), ...(lastOrders.available || [])].find(
        (x) => String(x.id) === String(id),
      ) || null;

    if (action === "maps") {
      if (order && order.customer) {
        openMaps(
          order.customer.addr || "",
          order.customer.lat,
          order.customer.lng,
        );
      }
      return;
    }

    if (action === "call") {
      const raw = String(order?.customer?.phone || "").trim();
      const phone = raw.replace(/[^\d+]/g, "");
      if (!phone) {
        el("dashHint").textContent =
          t().customerPhoneNA || "❌ رقم الزبون غير متوفر";
        return;
      }
      const url = "tel:" + phone;
      try {
        const a = document.createElement("a");
        a.href = url;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (_e) {
        try {
          window.open(url, "_self");
        } catch (_e2) {
          window.location.href = url;
        }
      }
      return;
    }

    if (action === "chat") {
      if (!order) return;
      openOrderChat(String(order.id));
      return;
    }

    if (action === "accept") {
      try {
        await api(`/api/driver/orders/${encodeURIComponent(id)}/accept`, {
          method: "POST",
        });
        newAlertActive = false;
        newAlertCount = 0;
        el("dashHint").textContent = t().okSaved;
        await loadOrders();
      } catch (err) {
        el("dashHint").textContent = `❌ ${err.message}`;
      }
      return;
    }

    if (action === "delivered" || action === "canceled") {
      const st = action === "delivered" ? "delivered" : "canceled";
      try {
        await api(`/api/driver/orders/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ status: st }),
        });
        newAlertActive = false;
        newAlertCount = 0;
        el("dashHint").textContent = t().okSaved;
        await loadOrders();
      } catch (err) {
        el("dashHint").textContent = `❌ ${err.message}`;
      }
      return;
    }
  });
}

/***********************
 * Order chat (Driver ↔ Customer)
 ***********************/
let CHAT_ORDER_ID = null;
let CHAT_POLL = null;

function showOrderChat(show) {
  const m = el("orderChatModal");
  if (!m) return;
  m.classList.toggle("show", !!show);
  if (!show) {
    CHAT_ORDER_ID = null;
    if (CHAT_POLL) {
      try {
        clearInterval(CHAT_POLL);
      } catch (_e) {}
    }
    CHAT_POLL = null;
  }
}

function fmtChatTime(ts) {
  const d = ts ? new Date(ts) : null;
  if (!d || isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function renderOrderChat(messages) {
  const tr = t();
  const box = el("orderChatBox");
  if (!box) return;
  const list = Array.isArray(messages) ? messages : [];
  box.innerHTML = "";
  if (!list.length) {
    box.innerHTML = `<div class="muted">${escapeHtml(tr.noMessagesYet || "No messages yet")}</div>`;
    return;
  }
  for (const m of list) {
    const mine = String(m.from || "") === "driver";
    const div = document.createElement("div");
    div.className = "chat-msg " + (mine ? "me" : "");
    const who = mine ? tr.you || "You" : tr.customer || "Customer";
    div.innerHTML = `<div class="chat-bubble">${escapeHtml(m.text || "")}</div><div class="chat-meta">${escapeHtml(who)} • ${escapeHtml(fmtChatTime(m.createdAt))}</div>`;
    box.appendChild(div);
  }
  box.scrollTop = box.scrollHeight + 9999;
}

async function loadOrderChat() {
  if (!CHAT_ORDER_ID) return;
  const tr = t();
  const res = await api(
    `/api/driver/orders/${encodeURIComponent(CHAT_ORDER_ID)}/chat`,
  );
  const title = el("orderChatTitle");
  if (title) {
    title.textContent = `${tr.orderChatTitlePrefix || "Order Chat #"}${CHAT_ORDER_ID}`;
  }
  renderOrderChat(res.messages || []);
}

async function sendOrderChat() {
  if (!CHAT_ORDER_ID) return;
  const input = el("orderChatInput");
  const hint = el("orderChatHint");
  const text = String(input?.value || "").trim();
  if (!text) return;
  if (input) input.value = "";
  if (hint) hint.textContent = "";
  try {
    await api(`/api/driver/orders/${encodeURIComponent(CHAT_ORDER_ID)}/chat`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    await loadOrderChat();
  } catch (e) {
    if (hint) hint.textContent = "❌ " + (e.message || e);
  }
}

function openOrderChat(orderId) {
  CHAT_ORDER_ID = String(orderId || "");
  showOrderChat(true);
  loadOrderChat().catch((e) => {
    const hint = el("orderChatHint");
    if (hint) hint.textContent = "❌ " + (e.message || e);
  });
  if (CHAT_POLL) {
    try {
      clearInterval(CHAT_POLL);
    } catch (_e) {}
  }
  CHAT_POLL = setInterval(() => {
    if (CHAT_ORDER_ID) loadOrderChat().catch(() => {});
  }, 3500);
}

(async function init() {
  bindEvents();
  applyI18n();
  if (soundEnabled) showSoundGate();

  document.addEventListener("pointerdown", unlockAudio, {
    once: true,
    passive: true,
    capture: true,
  });
  document.addEventListener("touchstart", unlockAudio, {
    once: true,
    passive: true,
    capture: true,
  });
  document.addEventListener("keydown", unlockAudio, {
    once: true,
    passive: true,
    capture: true,
  });

  if (!token) {
    setLoggedInUI(false);
    setActiveAuthTab("login");
    return;
  }

  try {
    await onLoggedIn();
  } catch (_e) {
    logout();
    setActiveAuthTab("login");
  }
})();

/***********************
 * PWA: ensure SW updates quickly
 ***********************/
(function ensureServiceWorkerFreshness() {
  try {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        try {
          reg.update && reg.update();
        } catch (_e) {}
        try {
          if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
        } catch (_e) {}
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (
              sw.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              try {
                reg.waiting &&
                  reg.waiting.postMessage({ type: "SKIP_WAITING" });
              } catch (_e) {}
            }
          });
        });
      })
      .catch(() => {});
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      try {
        window.location.reload();
      } catch (_e) {}
    });
  } catch (_e) {}
})();
