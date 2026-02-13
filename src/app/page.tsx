"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getFirebaseAuth } from "@/lib/firebaseClient";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "firebase/auth";

type Message = {
  role: "user" | "assistant";
  text: string;
};

type Conversation = {
  id: string;
  title: string;
  preview?: string;
  message_count?: number;
  last_message?: unknown;
};

type LanguageMode = "auto" | "english" | "hindi" | "marathi" | "tamil" | "telugu" | "punjabi";

type SpeechRecognitionEventLite = Event & {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
};

type SpeechRecognitionLite = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLite) => void) | null;
  onerror: ((event: Event) => void) | null;
  start: () => void;
  stop: () => void;
};

type WindowWithSpeech = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLite;
  webkitSpeechRecognition?: new () => SpeechRecognitionLite;
};

function getInitialMessages(lang: LanguageMode): Message[] {
  switch (lang) {
    case "hindi":
      return [
        {
          role: "assistant",
          text: "नमस्ते! मैं किसान सहायक—आपका खेती साथी हूँ। फसल, कीट, सिंचाई, मिट्टी या मौसम पर पूछें। बेहतर सलाह के लिए फसल, अवस्था और स्थान बताएं।"
        }
      ];
    case "marathi":
      return [
        {
          role: "assistant",
          text: "नमस्कार! मी किसान सहाय्यक—तुमचा शेती साथी आहे. पिके, कीड, सिंचन, माती किंवा हवामानाबद्दल विचारा. चांगल्या सल्ल्यासाठी पीक, अवस्था आणि ठिकाण सांगा."
        }
      ];
    case "tamil":
      return [
        {
          role: "assistant",
          text: "வணக்கம்! நான் கிசான் உதவியாளர்—உங்கள் விவசாய துணை. பயிர்கள், பூச்சி, பாசனம், மண் அல்லது வானிலை பற்றி கேளுங்கள். சிறந்த ஆலோசனைக்கு பயிர், நிலை, இடம் கூறுங்கள்."
        }
      ];
    case "telugu":
      return [
        {
          role: "assistant",
          text: "నమస్తే! నేను కిసాన్ సహాయకుడు—మీ వ్యవసాయ సహచరి. పంటలు, కీటకాలు, నీటిపారుదల, నేల లేదా వాతావరణం గురించి అడగండి. మెరుగైన సలహా కోసం పంట, దశ, స్థలం చెప్పండి."
        }
      ];
    case "punjabi":
      return [
        {
          role: "assistant",
          text: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਕਿਸਾਨ ਸਹਾਇਕ—ਤੁਹਾਡਾ ਖੇਤੀ ਸਾਥੀ ਹਾਂ। ਫਸਲਾਂ, ਕੀਟ, ਸਿੰਚਾਈ, ਮਿੱਟੀ ਜਾਂ ਮੌਸਮ ਬਾਰੇ ਪੁੱਛੋ। ਚੰਗੀ ਸਲਾਹ ਲਈ ਫਸਲ, ਦੌਰ ਅਤੇ ਥਾਂ ਦੱਸੋ।"
        }
      ];
    default:
      return [
        {
          role: "assistant",
          text: "Namaste! I’m Kisaan Sahayak—your farming partner. Ask about crops, pests, irrigation, soil, or weather. For sharper advice, share crop, stage, and location."
        }
      ];
  }
}

const langMap: Record<LanguageMode, string> = {
  auto: "en-IN",
  english: "en-IN",
  hindi: "hi-IN",
  marathi: "mr-IN",
  tamil: "ta-IN",
  telugu: "te-IN",
  punjabi: "pa-IN"
};

const languageOptions: { value: LanguageMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "english", label: "English" },
  { value: "hindi", label: "Hindi" },
  { value: "marathi", label: "Marathi" },
  { value: "tamil", label: "Tamil" },
  { value: "telugu", label: "Telugu" },
  { value: "punjabi", label: "Punjabi" }
];

const translations: Record<LanguageMode, Record<string, string>> = {
  auto: {},
  english: {
    conversations: "Conversations",
    newChat: "New Chat",
    search: "Search conversations...",
    sync: "Sync",
    settings: "Settings",
    profile: "Profile",
    signIn: "Sign In",
    language: "Language",
    location: "Location",
    updateLocation: "Update Location",
    voiceReply: "Voice Reply",
    clearChat: "Clear Chat",
    askPlaceholder: "Ask about crops, weather, farming...",
    send: "Send",
    guestLeft: "Guest left",
    connected: "Connected",
    noConversations: "No conversations yet",
    authTitle: "Kisaan Sahayak AI",
    signOut: "Sign Out",
    createAccount: "Create Account",
    fullName: "Full Name",
    email: "Email",
    password: "Password",
    haveAccount: "Already have an account?",
    noAccount: "Don't have an account?",
    login: "Sign In",
    register: "Register",
    voiceOn: "On",
    voiceOff: "Off",
    historyHint: "Sign in to save chat history.",
    heroTitle: "Practical farming guidance, right when you need it",
    heroSubtitle: "Crop care, pests, irrigation, soil health, and weather planning in one place."
  },
  hindi: {
    conversations: "बातचीत",
    newChat: "नई बातचीत",
    search: "बातचीत खोजें...",
    sync: "सिंक करें",
    settings: "सेटिंग्स",
    profile: "प्रोफ़ाइल",
    signIn: "साइन इन",
    language: "भाषा",
    location: "स्थान",
    updateLocation: "स्थान अपडेट करें",
    voiceReply: "आवाज़ उत्तर",
    clearChat: "चैट साफ़ करें",
    askPlaceholder: "फसल, मौसम, खेती के बारे में पूछें...",
    send: "भेजें",
    guestLeft: "मेहमान शेष",
    connected: "कनेक्टेड",
    noConversations: "अभी कोई बातचीत नहीं",
    authTitle: "किसान सहायक",
    signOut: "साइन आउट",
    createAccount: "खाता बनाएं",
    fullName: "पूरा नाम",
    email: "ईमेल",
    password: "पासवर्ड",
    haveAccount: "पहले से खाता है?",
    noAccount: "खाता नहीं है?",
    login: "साइन इन",
    register: "रजिस्टर",
    voiceOn: "चालू",
    voiceOff: "बंद",
    historyHint: "चैट इतिहास सहेजने के लिए साइन इन करें।",
    heroTitle: "ज़रूरत के समय व्यावहारिक खेती सलाह",
    heroSubtitle: "फसल देखभाल, कीट, सिंचाई, मिट्टी और मौसम की योजना एक जगह।"
  },
  marathi: {
    conversations: "बातचीत",
    newChat: "नवी बातचीत",
    search: "बातचीत शोधा...",
    sync: "सिंक",
    settings: "सेटिंग्स",
    profile: "प्रोफाइल",
    signIn: "साइन इन",
    language: "भाषा",
    location: "स्थान",
    updateLocation: "स्थान अपडेट करा",
    voiceReply: "आवाज उत्तर",
    clearChat: "चॅट साफ करा",
    askPlaceholder: "पीक, हवामान, शेतीबद्दल विचारा...",
    send: "पाठवा",
    guestLeft: "अतिथि शिल्लक",
    connected: "कनेक्टेड",
    noConversations: "अजून बातचीत नाही",
    authTitle: "किसान सहाय्यक",
    signOut: "साइन आउट",
    createAccount: "खाते तयार करा",
    fullName: "पूर्ण नाव",
    email: "ईमेल",
    password: "पासवर्ड",
    haveAccount: "आधीच खाते आहे?",
    noAccount: "खाते नाही?",
    login: "साइन इन",
    register: "नोंदणी",
    voiceOn: "चालू",
    voiceOff: "बंद",
    historyHint: "चॅट इतिहास साठवण्यासाठी साइन इन करा।",
    heroTitle: "वेळेवर मिळणारी उपयुक्त शेती मदत",
    heroSubtitle: "पीक देखभाल, कीड, सिंचन, माती आणि हवामान नियोजन एकाच ठिकाणी."
  },
  tamil: {
    conversations: "உரையாடல்கள்",
    newChat: "புதிய உரையாடல்",
    search: "உரையாடல் தேடு...",
    sync: "சிங்க்",
    settings: "அமைப்புகள்",
    profile: "சுயவிவரம்",
    signIn: "உள்நுழை",
    language: "மொழி",
    location: "இடம்",
    updateLocation: "இடத்தை புதுப்பி",
    voiceReply: "குரல் பதில்",
    clearChat: "அரட்டை அழி",
    askPlaceholder: "பயிர், வானிலை, விவசாயம் பற்றி கேளுங்கள்...",
    send: "அனுப்பு",
    guestLeft: "விருந்தினர் மீதி",
    connected: "இணைந்தது",
    noConversations: "உரையாடல் இல்லை",
    authTitle: "கிசான் உதவியாளர்",
    signOut: "வெளியேறு",
    createAccount: "கணக்கு உருவாக்கு",
    fullName: "முழுப் பெயர்",
    email: "மின்னஞ்சல்",
    password: "கடவுச்சொல்",
    haveAccount: "ஏற்கனவே கணக்கு உள்ளதா?",
    noAccount: "கணக்கு இல்லையா?",
    login: "உள்நுழை",
    register: "பதிவு",
    voiceOn: "ஆன்",
    voiceOff: "ஆஃப்",
    historyHint: "அரட்டை வரலாற்றை சேமிக்க உள்நுழைக.",
    heroTitle: "உங்களுக்கு தேவையான நேரத்தில் பயனுள்ள விவசாய வழிகாட்டல்",
    heroSubtitle: "பயிர் பராமரிப்பு, பூச்சிகள், பாசனம், மண், வானிலை திட்டமிடல் ஒரே இடத்தில்."
  },
  telugu: {
    conversations: "చర్చలు",
    newChat: "కొత్త చాట్",
    search: "చర్చలను వెతకండి...",
    sync: "సింక్",
    settings: "సెట్టింగ్స్",
    profile: "ప్రొఫైల్",
    signIn: "సైన్ ఇన్",
    language: "భాష",
    location: "స్థానం",
    updateLocation: "స్థానాన్ని నవీకరించండి",
    voiceReply: "వాయిస్ రిప్లై",
    clearChat: "చాట్ క్లియర్",
    askPlaceholder: "పంటలు, వాతావరణం, వ్యవసాయం గురించి అడగండి...",
    send: "పంపు",
    guestLeft: "అతిథి మిగిలింది",
    connected: "కనెక్ట్ అయింది",
    noConversations: "చర్చలు లేవు",
    authTitle: "కిసான் సహాయకుడు",
    signOut: "సైన్ అవుట్",
    createAccount: "ఖాతా సృష్టించండి",
    fullName: "పూర్తి పేరు",
    email: "ఇమెయిల్",
    password: "పాస్వర్డ్",
    haveAccount: "ఖాతా ఉందా?",
    noAccount: "ఖాతా లేదా?",
    login: "సైన్ ఇన్",
    register: "రిజిస్టర్",
    voiceOn: "ఆన్",
    voiceOff: "ఆఫ్",
    historyHint: "చాట్ చరిత్రను సేవ్ చేయడానికి సైన్ ఇన్ చేయండి.",
    heroTitle: "అవసరమైనప్పుడు అందే వ్యవసాయ మార్గనిర్దేశం",
    heroSubtitle: "పంట సంరక్షణ, కీటకాలు, నీటిపారుదల, నేల, వాతావరణ ప్రణాళిక ఒకే చోట."
  },
  punjabi: {
    conversations: "ਗੱਲਬਾਤ",
    newChat: "ਨਵੀਂ ਗੱਲਬਾਤ",
    search: "ਗੱਲਬਾਤ ਖੋਜੋ...",
    sync: "ਸਿੰਕ",
    settings: "ਸੈਟਿੰਗਜ਼",
    profile: "ਪ੍ਰੋਫ਼ਾਈਲ",
    signIn: "ਸਾਈਨ ਇਨ",
    language: "ਭਾਸ਼ਾ",
    location: "ਟਿਕਾਣਾ",
    updateLocation: "ਟਿਕਾਣਾ ਅਪਡੇਟ ਕਰੋ",
    voiceReply: "ਵੌਇਸ ਜਵਾਬ",
    clearChat: "ਚੈਟ ਸਾਫ ਕਰੋ",
    askPlaceholder: "ਫਸਲਾਂ, ਮੌਸਮ, ਖੇਤੀ ਬਾਰੇ ਪੁੱਛੋ...",
    send: "ਭੇਜੋ",
    guestLeft: "ਮਹਿਮਾਨ ਬਾਕੀ",
    connected: "ਜੁੜਿਆ",
    noConversations: "ਹਾਲੇ ਕੋਈ ਗੱਲਬਾਤ ਨਹੀਂ",
    authTitle: "ਕਿਸਾਨ ਸਹਾਇਕ",
    signOut: "ਸਾਈਨ ਆਉਟ",
    createAccount: "ਖਾਤਾ ਬਣਾਓ",
    fullName: "ਪੂਰਾ ਨਾਮ",
    email: "ਈਮੇਲ",
    password: "ਪਾਸਵਰਡ",
    haveAccount: "ਪਹਿਲਾਂ ਤੋਂ ਖਾਤਾ ਹੈ?",
    noAccount: "ਖਾਤਾ ਨਹੀਂ ਹੈ?",
    login: "ਸਾਈਨ ਇਨ",
    register: "ਰਜਿਸਟਰ",
    voiceOn: "ਆਨ",
    voiceOff: "ਆਫ",
    historyHint: "ਚੈਟ ਇਤਿਹਾਸ ਸੇਵ ਕਰਨ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ।",
    heroTitle: "ਜਦੋਂ ਲੋੜ ਹੋਵੇ ਤਦੋਂ ਵਰਤੋਂਯੋਗ ਖੇਤੀ ਮਦਦ",
    heroSubtitle: "ਫਸਲ ਸੰਭਾਲ, ਕੀਟ, ਸਿੰਚਾਈ, ਮਿੱਟੀ ਅਤੇ ਮੌਸਮ ਯੋਜਨਾ ਇੱਕ ਹੀ ਥਾਂ।"
  }
};

function getUiText(language: LanguageMode) {
  return { ...translations.english, ...(translations[language] || {}) };
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>(getInitialMessages("english"));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState<LanguageMode>("auto");
  const [location, setLocation] = useState("Unknown Location");
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authError, setAuthError] = useState("");
  const [user, setUser] = useState<null | { uid: string; email: string | null; name: string | null }>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLite | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const lastUserMessageRef = useRef<string | null>(null);
  const lastAssistantMessageRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);

  const guestLimit = useMemo(() => Number(process.env.NEXT_PUBLIC_GUEST_QUERY_LIMIT || "5"), []);
  const [used, setUsed] = useState(0);

  useEffect(() => {
    setUsed(Number(localStorage.getItem("guest_query_count") || "0"));
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (current) => {
      if (!current) {
        setUser(null);
        setConversations([]);
        setActiveConversationId(null);
        return;
      }
      setUser({ uid: current.uid, email: current.email, name: current.displayName });
    });
    return () => unsub();
  }, []);

  const fetchWithAuth = useCallback(async (input: RequestInfo, init?: RequestInit) => {
    const auth = getFirebaseAuth();
    const token = await auth?.currentUser?.getIdToken();
    const headers = new Headers(init?.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  }, []);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoadingConversations(true);
    try {
      const res = await fetchWithAuth("/api/conversations");
      if (!res.ok) throw new Error("Failed to load conversations");
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversations");
    } finally {
      setLoadingConversations(false);
    }
  }, [fetchWithAuth, user]);

  useEffect(() => {
    if (!user) return;
    void loadConversations();
  }, [loadConversations, user]);

  useEffect(() => {
    const w = window as WindowWithSpeech;
    const SpeechRecognitionImpl = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognitionImpl) return;

    const loadVoices = () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.getVoices();
      }
    };
    loadVoices();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    const recognition = new SpeechRecognitionImpl();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = langMap[language];

    recognition.onresult = (event: SpeechRecognitionEventLite) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      if (transcript.trim()) {
        setInput((prev) => `${prev} ${transcript}`.trim());
      }
      setIsListening(false);
    };

    recognition.onerror = () => {
      setError(language === "hindi" ? "वॉइस इनपुट असफल हुआ। कृपया टाइप करें।" : "Voice input failed. Please type your question.");
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    return () => {
      recognitionRef.current = null;
    };
  }, [language]);

  useEffect(() => {
    const lang = language === "auto" ? "english" : language;
    if (lang === "hindi" || lang === "marathi") {
      document.body.setAttribute("data-lang", "hi");
    } else if (lang === "tamil") {
      document.body.setAttribute("data-lang", "ta");
    } else if (lang === "telugu") {
      document.body.setAttribute("data-lang", "te");
    } else if (lang === "punjabi") {
      document.body.setAttribute("data-lang", "pa");
    } else {
      document.body.setAttribute("data-lang", "en");
    }
    setMessages((prev) => {
      if (prev.length !== 1 || prev[0].role !== "assistant") return prev;
      return getInitialMessages(lang);
    });
  }, [language]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem("seen_auth_prompt");
    if (!seen && !user) {
      setAuthModalOpen(true);
      localStorage.setItem("seen_auth_prompt", "1");
    }
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function loadConversationMessages(conversationId: string) {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/conversations/${conversationId}/messages`);
      if (!res.ok) throw new Error("Failed to load messages");
      const data = await res.json();
      const loaded = (data.messages || []).map((m: { role: "user" | "assistant"; text: string }) => ({
        role: m.role,
        text: m.text
      }));
      setMessages(loaded.length ? loaded : getInitialMessages(language === "auto" ? "english" : language));
      setActiveConversationId(conversationId);
      setSidebarOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }

  async function deleteConversation(conversationId: string) {
    if (!user) return;
    try {
      const res = await fetchWithAuth(`/api/conversations/${conversationId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete conversation");
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
        setMessages(getInitialMessages(language === "auto" ? "english" : language));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete conversation");
    }
  }

  function pickIndianVoice(lang: string) {
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) =>
        v.lang.toLowerCase().startsWith(lang.toLowerCase()) &&
        /india|hindi|marathi|tamil|telugu|punjabi|heera|lekha|lata|ravi/i.test(v.name + v.lang)
    );
    return preferred || voices.find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase())) || null;
  }

  function speakText(text: string) {
    if (!voiceReplyEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langMap[language];
    utterance.rate = 1;
    const voice = pickIndianVoice(utterance.lang);
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }

  function isElaborationHint(text: string) {
    const t = text.toLowerCase().trim();
    if (!t || t.length > 60) return false;
    return [
      "elaborate",
      "expand",
      "more detail",
      "detail",
      "in detail",
      "विस्तार",
      "विस्तृत",
      "समझाएं",
      "और बताएं",
      "और बताइए"
    ].some((phrase) => t.includes(phrase));
  }

  function isFollowUpHint(text: string) {
    const t = text.toLowerCase().trim();
    if (!t || t.length > 80) return false;
    return [
      "what should i do",
      "what do i do",
      "next step",
      "next steps",
      "how do i fix",
      "how to fix",
      "what can i do",
      "what now",
      "what should i do next",
      "how do i proceed",
      "solution",
      "treatment",
      "fix this",
      "what about it",
      "क्या करूं",
      "अब क्या करूं",
      "क्या करना चाहिए",
      "अगला कदम",
      "मैं क्या करूं",
      "उपाय क्या है"
    ].some((phrase) => t.includes(phrase));
  }

  function startVoiceInput() {
    if (!recognitionRef.current) {
      setError(language === "hindi" ? "इस ब्राउज़र में वॉइस इनपुट समर्थित नहीं है।" : "Voice input is not supported in this browser.");
      return;
    }

    try {
      setError("");
      recognitionRef.current.lang = langMap[language];
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      setError(language === "hindi" ? "माइक्रोफ़ोन शुरू नहीं हो सका।" : "Could not start microphone. Check browser mic permissions.");
      setIsListening(false);
    }
  }

  async function fetchLocation() {
    setError("");
    if (!navigator.geolocation) {
      setError(language === "hindi" ? "इस ब्राउज़र में लोकेशन उपलब्ध नहीं है।" : "Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const response = await fetch(
            `/api/reverse-geocode?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`
          );
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Could not resolve location");
          setLocation(data.location || `${lat.toFixed(4)}, ${lon.toFixed(4)}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : language === "hindi" ? "लोकेशन लाने में त्रुटि हुई।" : "Location fetch failed");
        }
      },
      () => setError(language === "hindi" ? "लोकेशन अनुमति नहीं मिली।" : "Location permission denied or unavailable."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    if (!user && used >= guestLimit) {
      setError(
        language === "hindi"
          ? `मेहमान सीमा पूरी हो गई (${guestLimit}). कृपया साइन इन करें।`
          : `Guest limit reached (${guestLimit}). Please sign in to continue.`
      );
      return;
    }

    setError("");
    const userText = input.trim();
    const elaborateHint = isElaborationHint(userText);
    const followUpHint = isFollowUpHint(userText);
    const payloadMessage = elaborateHint && lastUserMessageRef.current ? lastUserMessageRef.current : userText;

    const requestId = (requestIdRef.current += 1);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setLoading(true);

    try {
      const token = await getFirebaseAuth()?.currentUser?.getIdToken();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          message: payloadMessage,
          language,
          location,
          conversation_id: activeConversationId || undefined,
          elaborate: elaborateHint,
          previous_answer: elaborateHint || followUpHint ? lastAssistantMessageRef.current : undefined
        })
      });

      if (!res.ok) {
        const bad = await res.json().catch(() => ({}));
        throw new Error(bad.error || (language === "hindi" ? "अनुरोध असफल" : "Request failed"));
      }

      const data = await res.json();
      if (requestId !== requestIdRef.current) return;
      const assistantText = data.reply || "No response";
      setMessages((prev) => [...prev, { role: "assistant", text: assistantText }]);
      speakText(assistantText);

      if (!elaborateHint) {
        lastUserMessageRef.current = userText;
        lastAssistantMessageRef.current = assistantText;
      }

      if (data.conversation_id) {
        setActiveConversationId(data.conversation_id);
        void loadConversations();
      }

      if (!user && typeof data.guest_remaining === "number") {
        const nextUsed = Math.max(0, guestLimit - data.guest_remaining);
        localStorage.setItem("guest_query_count", String(nextUsed));
        setUsed(nextUsed);
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : language === "hindi" ? "अज्ञात त्रुटि" : "Unknown error");
    } finally {
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
    }
  }

  async function submitAuth(e: FormEvent) {
    e.preventDefault();
    setAuthError("");

    try {
      if (authMode === "login") {
        const auth = getFirebaseAuth();
        if (!auth) throw new Error("Auth not available");
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        const auth = getFirebaseAuth();
        if (!auth) throw new Error("Auth not available");
        const cred = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        if (authName.trim()) {
          await updateProfile(cred.user, { displayName: authName.trim() });
        }
      }
      setAuthPassword("");
      setAuthName("");
      setAuthModalOpen(false);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : language === "hindi" ? "प्रमाणीकरण असफल" : "Authentication failed");
    }
  }

  async function handleSignOut() {
    setAuthError("");
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
    setAuthModalOpen(false);
  }

  function handleClearChat() {
    const lang = language === "auto" ? "english" : language;
    setMessages(getInitialMessages(lang));
  }

  function handleNewChat() {
    const lang = language === "auto" ? "english" : language;
    setMessages(getInitialMessages(lang));
    setActiveConversationId(null);
    setSidebarOpen(false);
    if (user) void loadConversations();
  }

  function handleLanguageChange(nextLanguage: LanguageMode) {
    if (nextLanguage === language) return;
    requestIdRef.current += 1;
    setLoading(false);
    setError("");
    setInput("");
    setLanguage(nextLanguage);
    const lang = nextLanguage === "auto" ? "english" : nextLanguage;
    setMessages(getInitialMessages(lang));
    setActiveConversationId(null);
    setSidebarOpen(false);
    lastUserMessageRef.current = null;
    lastAssistantMessageRef.current = null;
    if (user) void loadConversations();
  }

  const guestRemaining = user ? null : Math.max(0, guestLimit - used);
  const langForUi = language === "auto" ? "english" : language;
  const t = getUiText(langForUi);

  return (
    <div className="app-container">
      <aside className={`conversation-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <button className="menu-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            X
          </button>
          <h3>{t.conversations}</h3>
          <button className="new-chat-btn" onClick={handleNewChat}>
            + {t.newChat}
          </button>
        </div>
        <div className="sidebar-search">
          <input className="search-input" placeholder={t.search} />
        </div>
        <ul className="conversation-list">
          {!user ? (
            <li className="conversation-empty">{t.historyHint}</li>
          ) : loadingConversations ? (
            <li className="conversation-empty">Loading...</li>
          ) : conversations.length ? (
            conversations.map((conv) => (
              <li
                key={conv.id}
                className={`conversation-item ${activeConversationId === conv.id ? "active" : ""}`}
                onClick={() => loadConversationMessages(conv.id)}
              >
                <div className="conversation-content">
                  <h4 className="conversation-title">{conv.title || t.newChat}</h4>
                  <p className="conversation-preview">{conv.preview || ""}</p>
                </div>
                <div className="conversation-actions">
                  <button
                    className="conversation-delete"
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteConversation(conv.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))
          ) : (
            <li className="conversation-empty">{t.noConversations}</li>
          )}
        </ul>
        <div className="sidebar-footer">
          <button className="sync-btn" onClick={() => void loadConversations()} disabled={!user}>
            {t.sync}
          </button>
        </div>
      </aside>

      <div className={`sidebar-overlay ${sidebarOpen ? "active" : ""}`} onClick={() => setSidebarOpen(false)} />

      <main className="main-area">
        <header className="header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button className="menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Menu">
              Menu
            </button>
            <h1>Kisaan Sahayak AI</h1>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="settings-toggle" onClick={() => setAuthModalOpen(true)} aria-label="Profile">
              {user ? t.profile : t.signIn}
            </button>
            <button className="settings-toggle" onClick={() => setSettingsOpen((v) => !v)} aria-label="Settings">
              {t.settings}
            </button>
            <button
              className="settings-toggle"
              onClick={() => {
                const idx = languageOptions.findIndex((opt) => opt.value === language);
                const next = languageOptions[(idx + 1) % languageOptions.length];
                handleLanguageChange(next.value);
              }}
              aria-label="Language"
            >
              {language === "auto" ? "AUTO" : language.slice(0, 2).toUpperCase()}
            </button>
          </div>
        </header>

        <div className="main-content">
          <section className="hero">
            <div className="hero-copy">
              <p className="hero-kicker">Kisaan Sahayak</p>
              <h2 className="hero-title">{t.heroTitle}</h2>
              <p className="hero-subtitle">{t.heroSubtitle}</p>
            </div>
            <div className="hero-images" aria-hidden="true">
              <img src="/farm-field.svg" alt="" />
              <img src="/farmer-tools.svg" alt="" />
            </div>
          </section>
          <div className="chat-container" id="chatContainer">
            {messages.map((msg, idx) => (
              <div key={`${msg.role}-${idx}`} className={`flex ${msg.role}`} style={{ marginBottom: "1rem" }}>
                <div className="avatar">{msg.role === "user" ? "U" : "AI"}</div>
                <div>
                  <div className={`message-bubble ${msg.role === "user" ? "user-bubble" : "assistant-bubble"}`}>
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
            {loading ? (
              <div className="typing-indicator flex assistant" style={{ marginBottom: "1rem" }}>
                <div className="avatar">AI</div>
                <div className="typing-bubble">
                  <span className="typing-dots" />
                </div>
              </div>
            ) : null}
            <div ref={chatEndRef} />
          </div>

          <div className="status-bar">
            <div className="status-item">{location}</div>
            <div className="status-item">{t.connected}</div>
            {guestRemaining !== null ? (
              <div className="status-item">
                {t.guestLeft}: {guestRemaining}
              </div>
            ) : null}
          </div>

          {error ? (
            <div style={{ padding: "0.5rem 1rem", color: "#C62828", fontWeight: 600 }}>{error}</div>
          ) : null}

          <div className="input-container">
            <form onSubmit={onSubmit} style={{ display: "flex", alignItems: "center" }}>
              <input
                type="text"
                className="input-field"
                placeholder={t.askPlaceholder}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoComplete="off"
              />
              <button type="submit" className="send-button" disabled={loading}>
                {t.send}
              </button>
              <button type="button" className="voice-button" onClick={startVoiceInput} aria-pressed={isListening}>
                Mic
              </button>
            </form>
          </div>
        </div>
      </main>

      <div className={`settings ${settingsOpen ? "active" : ""}`} id="settingsPanel">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3>{t.settings}</h3>
          <button className="menu-close" onClick={() => setSettingsOpen(false)} aria-label="Close settings">
            X
          </button>
        </div>
        <div className="space-y-4">
          <div className="setting-group">
            <p>{t.language}</p>
            <select value={language} onChange={(e) => handleLanguageChange(e.target.value as LanguageMode)}>
              {languageOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="setting-group">
            <p>{t.location}</p>
            <p id="locationDisplay">{location}</p>
            <button onClick={fetchLocation} type="button">
              {t.updateLocation}
            </button>
          </div>

          <div className="setting-group">
            <button
              id="voiceReplyToggle"
              type="button"
              className="clear-button"
              onClick={() => setVoiceReplyEnabled((v) => !v)}
            >
              {t.voiceReply}: {voiceReplyEnabled ? t.voiceOn : t.voiceOff}
            </button>
          </div>

          <div className="setting-group">
            <button id="clearChatBtn" className="clear-button" onClick={handleClearChat}>
              {t.clearChat}
            </button>
          </div>
        </div>
      </div>

      <div className={`settings-overlay ${settingsOpen ? "active" : ""}`} onClick={() => setSettingsOpen(false)} />

      {authModalOpen ? (
        <div className="auth-modal" onClick={() => setAuthModalOpen(false)}>
          <div className="auth-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="auth-modal-header">
              <h2>{t.authTitle}</h2>
              <button className="auth-modal-close" onClick={() => setAuthModalOpen(false)}>
                ×
              </button>
            </div>
            {user ? (
              <div className="auth-form">
                <h3>{t.profile}</h3>
                <p style={{ marginBottom: "1rem" }}>{user.name || user.email || user.uid}</p>
                <button className="auth-btn" onClick={handleSignOut}>
                  {t.signOut}
                </button>
              </div>
            ) : (
              <form className="auth-form" onSubmit={submitAuth}>
                <h3>{authMode === "login" ? t.login : t.createAccount}</h3>
                {authMode === "register" ? (
                  <div className="form-group">
                    <label>{t.fullName}</label>
                    <input
                      type="text"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      placeholder={t.fullName}
                    />
                  </div>
                ) : null}
                <div className="form-group">
                  <label>{t.email}</label>
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder={t.email}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{t.password}</label>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder={t.password}
                    required
                  />
                </div>
                <button className="auth-btn" type="submit">
                  {authMode === "login" ? t.login : t.createAccount}
                </button>
                {authError ? <p style={{ color: "#C62828", marginTop: "0.75rem" }}>{authError}</p> : null}
                <p className="auth-switch">
                  {authMode === "login" ? t.noAccount : t.haveAccount}
                  <button
                    type="button"
                    className="auth-link"
                    onClick={() => setAuthMode((m) => (m === "login" ? "register" : "login"))}
                  >
                    {authMode === "login" ? t.register : t.login}
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
