import {
  Activity,
  Bot,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudOff,
  ClipboardList,
  Download,
  Dumbbell,
  Globe,
  Layers,
  LayoutDashboard,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Send,
  Soup,
  Trash2,
  Upload,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { hasSupabaseConfig, supabase, type AuthSession } from "./supabaseClient";

type View = "dashboard" | "calendar" | "courses" | "sport" | "platforms" | "ai" | "day";
type Priority = "normal" | "deadline" | "exam" | "lab";
type TaskCategory = "estudio" | "personal" | "admin" | "salud";
type RoutineType = "clase" | "estudio" | "deporte" | "personal";
type EventType = "clase" | "estudio" | "deadline" | "exam" | "work" | "tarea" | "personal";
type Intensity = "suave" | "media" | "alta";

interface Task {
  id: string;
  title: string;
  date: string;
  completed: boolean;
  priority: Priority;
  category: TaskCategory;
  notes: string;
}

interface CourseCalendar {
  id: string;
  name: string;
  color: string;
  location: string;
  notes: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  start: string;
  end: string;
  calendarId: string;
  type: EventType;
  notes: string;
}

interface RoutineItem {
  id: string;
  weekday: number;
  start: string;
  end: string;
  type: RoutineType;
  title: string;
}

interface MealLog {
  date: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  snacks: string;
}

interface WorkoutLog {
  date: string;
  activity: string;
  duration: number;
  intensity: Intensity;
  notes: string;
}

interface SportEntry extends WorkoutLog {
  id: string;
  type: string;
}

interface DailyNote {
  date: string;
  text: string;
  energy: number;
  sleep?: number;
  mood: string;
  studyFocus: string;
}

interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface AgendaData {
  tasks: Task[];
  courseCalendars: CourseCalendar[];
  events: CalendarEvent[];
  routine: RoutineItem[];
  meals: Record<string, MealLog>;
  workouts: Record<string, WorkoutLog>;
  sports: SportEntry[];
  aiMessages: AiChatMessage[];
  notes: Record<string, DailyNote>;
}

const STORAGE_KEY = "agenda-tue-data-v1";
const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const fullWeekdays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const hours = Array.from({ length: 15 }, (_, index) => index + 7);
const colors = ["#c94028", "#2666a3", "#157f63", "#be8427", "#6d5bd0", "#0f8a91"];
const platforms = [
  {
    name: "TimeEdit",
    url: "https://cloud.timeedit.net/nl_tue/web/stud01/",
    domain: "cloud.timeedit.net",
    description: "Horarios y planificación de clases.",
  },
  {
    name: "Gmail",
    url: "https://mail.google.com/",
    domain: "gmail.com",
    logo: "https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico",
    description: "Correo personal y mensajes importantes.",
  },
  {
    name: "Canvas TU/e",
    url: "https://canvas.tue.nl/",
    domain: "canvas.tue.nl",
    description: "Courses, assignments y announcements.",
  },
  {
    name: "Osiris",
    url: "https://engine.surfconext.nl/authentication/sp/consume-assertion",
    domain: "surfconext.nl",
    description: "Portal académico y registros.",
  },
  {
    name: "Education Guide",
    url: "https://educationguide.tue.nl/programs/bachelor-college/majors/bachelor-mechanical-engineering",
    domain: "educationguide.tue.nl",
    description: "Bachelor Mechanical Engineering guide.",
  },
];
const eventTypeStyles: Record<EventType, { label: string; color: string; background: string }> = {
  clase: { label: "Clase", color: "#2666a3", background: "#eaf2fb" },
  estudio: { label: "Estudio", color: "#157f63", background: "#e8f5f0" },
  deadline: { label: "Deadline", color: "#c94028", background: "#fff0eb" },
  exam: { label: "Exam", color: "#8a3ffc", background: "#f1ecff" },
  work: { label: "Work", color: "#be8427", background: "#fff5df" },
  tarea: { label: "Tarea", color: "#334155", background: "#eef2f7" },
  personal: { label: "Personal", color: "#0f8a91", background: "#e8f7f8" },
};

const defaultCourseCalendars: CourseCalendar[] = [
  { id: "etchis", name: "Etchis", color: "#c94028", location: "TU/e", notes: "" },
  { id: "energy-storage-cbl", name: "Energy storage system CBL", color: "#2666a3", location: "TU/e", notes: "" },
  { id: "signals-systems", name: "Signals and Systems", color: "#157f63", location: "TU/e", notes: "" },
];

const initialData: AgendaData = {
  tasks: [
    {
      id: crypto.randomUUID(),
      title: "Preparar bloques de estudio de Energy Systems",
      date: todayKey(),
      completed: false,
      priority: "deadline",
      category: "estudio",
      notes: "Divide en teoría, ejercicios y resumen.",
    },
  ],
  courseCalendars: defaultCourseCalendars,
  events: [
    {
      id: crypto.randomUUID(),
      title: "Energy storage CBL",
      date: todayKey(),
      start: "10:00",
      end: "12:00",
      calendarId: "energy-storage-cbl",
      type: "clase",
      notes: "",
    },
  ],
  routine: [
    { id: crypto.randomUUID(), weekday: 0, start: "09:00", end: "11:00", type: "clase", title: "Lecture / campus" },
    { id: crypto.randomUUID(), weekday: 3, start: "17:30", end: "18:30", type: "deporte", title: "Gym / running" },
  ],
  meals: {},
  workouts: {},
  sports: [],
  aiMessages: [],
  notes: {},
};

function todayKey(date = new Date()) {
  return toDateKey(date);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(key: string, amount: number) {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

function startOfWeekKey(key: string) {
  const date = fromDateKey(key);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return toDateKey(date);
}

function monthGridDays(key: string) {
  const current = fromDateKey(key);
  const firstOfMonth = new Date(current.getFullYear(), current.getMonth(), 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  firstOfMonth.setDate(firstOfMonth.getDate() - startOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstOfMonth);
    day.setDate(firstOfMonth.getDate() + index);
    return toDateKey(day);
  });
}

function weekdayIndex(key: string) {
  return (fromDateKey(key).getDay() + 6) % 7;
}

function formatDate(key: string, mode: "short" | "long" = "long") {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: mode === "long" ? "long" : undefined,
    day: "numeric",
    month: mode === "long" ? "long" : "short",
  }).format(fromDateKey(key));
}

function timeToMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function eventPosition(event: CalendarEvent) {
  const start = timeToMinutes(event.start);
  const end = Math.max(timeToMinutes(event.end), start + 30);
  const top = ((start - 7 * 60) / 60) * 64;
  const height = Math.max(((end - start) / 60) * 64 - 6, 86);
  return { top, height };
}

function createEmptyMeal(date: string): MealLog {
  return { date, breakfast: "", lunch: "", dinner: "", snacks: "" };
}

function createEmptyWorkout(date: string): WorkoutLog {
  return { date, activity: "", duration: 0, intensity: "media", notes: "" };
}

function createEmptyNote(date: string): DailyNote {
  return { date, text: "", energy: 3, sleep: 7, mood: "En foco", studyFocus: "" };
}

function normalizeData(parsed: Partial<AgendaData>): AgendaData {
  const calendars = Array.isArray(parsed.courseCalendars) && parsed.courseCalendars.length > 0
    ? parsed.courseCalendars
    : defaultCourseCalendars;

  const normalizedEvents = Array.isArray(parsed.events)
    ? parsed.events.map((event) => ({
      ...event,
      type: event.type && event.type in eventTypeStyles ? event.type : "clase",
    }))
    : [];

  return {
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    courseCalendars: calendars,
    events: normalizedEvents,
    routine: Array.isArray(parsed.routine) ? parsed.routine : [],
    meals: parsed.meals ?? {},
    workouts: parsed.workouts ?? {},
    sports: Array.isArray(parsed.sports) ? parsed.sports : [],
    aiMessages: Array.isArray(parsed.aiMessages) ? parsed.aiMessages : [],
    notes: parsed.notes ?? {},
  };
}

function loadData(): AgendaData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return initialData;
    return normalizeData(JSON.parse(stored) as Partial<AgendaData>);
  } catch {
    return initialData;
  }
}

export default function App() {
  const [data, setData] = useState<AgendaData>(() => loadData());
  const [view, setView] = useState<View>("dashboard");
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [taskDraft, setTaskDraft] = useState({ title: "", priority: "normal" as Priority, category: "estudio" as TaskCategory });
  const [eventDraft, setEventDraft] = useState({
    title: "",
    date: todayKey(),
    start: "09:00",
    end: "10:00",
    calendarId: defaultCourseCalendars[0].id,
    type: "clase" as EventType,
    notes: "",
  });
  const [courseDraft, setCourseDraft] = useState({ name: "", color: colors[3], location: "TU/e", notes: "" });
  const [aiDraft, setAiDraft] = useState("Dame una receta fácil con arroz, huevos y algo de verdura.");
  const [aiApiKey, setAiApiKey] = useState(() => localStorage.getItem("agenda-tue-openai-key") ?? "");
  const [aiModel, setAiModel] = useState(() => localStorage.getItem("agenda-tue-ai-model") ?? "gpt-5.2");
  const [aiLoading, setAiLoading] = useState(false);
  const [sportDraft, setSportDraft] = useState({
    date: todayKey(),
    type: "Gym",
    activity: "",
    duration: 45,
    intensity: "media" as Intensity,
    notes: "",
  });
  const [routineDraft, setRoutineDraft] = useState({
    weekday: weekdayIndex(todayKey()),
    start: "09:00",
    end: "10:00",
    type: "estudio" as RoutineType,
    title: "",
  });
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authDraft, setAuthDraft] = useState({ email: "", password: "" });
  const [authLoading, setAuthLoading] = useState(false);
  const [cloudReady, setCloudReady] = useState(!hasSupabaseConfig);
  const [syncStatus, setSyncStatus] = useState(hasSupabaseConfig ? "Sin iniciar sesión" : "Configura Supabase");
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: authData }) => {
      setSession(authData.session);
      setSyncStatus(authData.session ? "Conectando nube..." : "Sin iniciar sesión");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setCloudReady(!nextSession);
      setSyncStatus(nextSession ? "Conectando nube..." : "Sin iniciar sesión");
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user.id) return;

    const client = supabase;
    const userId = session.user.id;
    let cancelled = false;

    async function loadCloudData() {
      setCloudReady(false);
      setSyncStatus("Cargando nube...");
      const { data: row, error } = await client
        .from("user_agendas")
        .select("data")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setSyncStatus(`Error nube: ${error.message}`);
        return;
      }

      if (row?.data) {
        setData(normalizeData(row.data as Partial<AgendaData>));
      } else {
        const { error: saveError } = await client
          .from("user_agendas")
          .upsert({ user_id: userId, data, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
        if (saveError) {
          setSyncStatus(`Error nube: ${saveError.message}`);
          return;
        }
      }

      setCloudReady(true);
      setSyncStatus("Nube sincronizada");
    }

    loadCloudData();

    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  useEffect(() => {
    if (!supabase || !session?.user.id || !cloudReady) return;

    const client = supabase;
    const userId = session.user.id;
    setSyncStatus("Guardando...");
    const timer = window.setTimeout(async () => {
      const { error } = await client
        .from("user_agendas")
        .upsert({ user_id: userId, data, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      setSyncStatus(error ? `Error nube: ${error.message}` : "Nube sincronizada");
    }, 700);

    return () => window.clearTimeout(timer);
  }, [data, session?.user.id, cloudReady]);

  useEffect(() => {
    localStorage.setItem("agenda-tue-openai-key", aiApiKey);
  }, [aiApiKey]);

  useEffect(() => {
    localStorage.setItem("agenda-tue-ai-model", aiModel);
  }, [aiModel]);

  useEffect(() => {
    setEventDraft((current) => ({
      ...current,
      date: selectedDate,
      calendarId: data.courseCalendars[0]?.id ?? "general",
    }));
    setSportDraft((current) => ({ ...current, date: selectedDate }));
  }, [selectedDate, data.courseCalendars]);

  const weekStart = startOfWeekKey(selectedDate);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const selectedTasks = data.tasks.filter((task) => task.date === selectedDate);
  const weekTasks = data.tasks.filter((task) => weekDays.includes(task.date));
  const weekEvents = data.events.filter((event) => weekDays.includes(event.date));
  const weekSports = data.sports.filter((sport) => weekDays.includes(sport.date));
  const meal = data.meals[selectedDate] ?? createEmptyMeal(selectedDate);
  const workout = data.workouts[selectedDate] ?? createEmptyWorkout(selectedDate);
  const note = data.notes[selectedDate] ?? createEmptyNote(selectedDate);

  const stats = useMemo(() => {
    const openTasks = data.tasks.filter((task) => !task.completed);
    const urgentTasks = openTasks.filter((task) => task.priority !== "normal");
    const completedThisWeek = weekTasks.filter((task) => task.completed).length;
    const sportMinutes = weekSports.reduce((sum, item) => sum + item.duration, 0);
    return { openTasks, urgentTasks, completedThisWeek, sportMinutes };
  }, [data.tasks, weekTasks, weekSports]);

  function updateData(updater: (current: AgendaData) => AgendaData) {
    setData((current) => updater(current));
  }

  function addTask(date = selectedDate) {
    if (!taskDraft.title.trim()) return;
    updateData((current) => ({
      ...current,
      tasks: [
        {
          id: crypto.randomUUID(),
          title: taskDraft.title.trim(),
          date,
          completed: false,
          priority: taskDraft.priority,
          category: taskDraft.category,
          notes: "",
        },
        ...current.tasks,
      ],
    }));
    setTaskDraft({ title: "", priority: "normal", category: "estudio" });
  }

  function patchTask(id: string, patch: Partial<Task>) {
    updateData((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === id ? { ...task, ...patch } : task)),
    }));
  }

  function deleteTask(id: string) {
    updateData((current) => ({ ...current, tasks: current.tasks.filter((task) => task.id !== id) }));
  }

  function addEvent() {
    if (!eventDraft.title.trim() || !eventDraft.calendarId) return;
    updateData((current) => ({
      ...current,
      events: [
        ...current.events,
        { ...eventDraft, id: crypto.randomUUID(), title: eventDraft.title.trim() },
      ].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)),
    }));
    setEventDraft({ ...eventDraft, title: "", notes: "" });
  }

  function deleteEvent(id: string) {
    updateData((current) => ({ ...current, events: current.events.filter((event) => event.id !== id) }));
  }

  function copyClassesFromPreviousWeek() {
    updateData((current) => {
      const copiedClasses = weekDays.flatMap((targetDay) => {
        const sourceDay = addDays(targetDay, -7);
        return current.events
          .filter((event) => event.date === sourceDay && event.type === "clase")
          .map((event) => ({ ...event, id: crypto.randomUUID(), date: targetDay }));
      });

      const newClasses = copiedClasses.filter((candidate) => !current.events.some((event) => (
        event.date === candidate.date &&
        event.start === candidate.start &&
        event.end === candidate.end &&
        event.title === candidate.title &&
        event.calendarId === candidate.calendarId &&
        event.type === "clase"
      )));

      if (newClasses.length === 0) return current;

      return {
        ...current,
        events: [...current.events, ...newClasses].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)),
      };
    });
  }

  function addCourseCalendar() {
    if (!courseDraft.name.trim()) return;
    updateData((current) => ({
      ...current,
      courseCalendars: [
        ...current.courseCalendars,
        { id: crypto.randomUUID(), ...courseDraft, name: courseDraft.name.trim() },
      ],
    }));
    setCourseDraft({ name: "", color: colors[(data.courseCalendars.length + 1) % colors.length], location: "TU/e", notes: "" });
  }

  function patchCourseCalendar(id: string, patch: Partial<CourseCalendar>) {
    updateData((current) => ({
      ...current,
      courseCalendars: current.courseCalendars.map((calendar) => (calendar.id === id ? { ...calendar, ...patch } : calendar)),
    }));
  }

  function deleteCourseCalendar(id: string) {
    if (data.courseCalendars.length <= 1) return;
    const fallback = data.courseCalendars.find((calendar) => calendar.id !== id)?.id ?? data.courseCalendars[0].id;
    updateData((current) => ({
      ...current,
      courseCalendars: current.courseCalendars.filter((calendar) => calendar.id !== id),
      events: current.events.map((event) => (event.calendarId === id ? { ...event, calendarId: fallback } : event)),
    }));
  }

  async function sendAiMessage() {
    if (!aiDraft.trim() || !aiApiKey.trim() || aiLoading) return;

    const userMessage: AiChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: aiDraft.trim(),
      createdAt: new Date().toISOString(),
    };
    const conversation = [...data.aiMessages, userMessage].slice(-12);

    updateData((current) => ({ ...current, aiMessages: [...current.aiMessages, userMessage] }));
    setAiDraft("");
    setAiLoading(true);

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aiApiKey.trim()}`,
        },
        body: JSON.stringify({
          model: aiModel.trim() || "gpt-5.2",
          instructions: "Eres una IA simple dentro de una agenda personal de Juan. Responde en español, claro y directo. Ayuda con recetas, ideas de comida, estudio, deporte y organización diaria. Si te preguntan por salud o dietas estrictas, da consejos generales y recomienda consultar a un profesional cuando haga falta.",
          input: conversation.map((message) => `${message.role === "user" ? "Juan" : "IA"}: ${message.content}`).join("\n\n"),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error?.message ?? "No he podido conectar con la IA.");
      }

      const assistantMessage: AiChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: extractResponseText(result),
        createdAt: new Date().toISOString(),
      };
      updateData((current) => ({ ...current, aiMessages: [...current.aiMessages, assistantMessage] }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido.";
      updateData((current) => ({
        ...current,
        aiMessages: [
          ...current.aiMessages,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `No he podido responder: ${message}`,
            createdAt: new Date().toISOString(),
          },
        ],
      }));
    } finally {
      setAiLoading(false);
    }
  }

  function clearAiChat() {
    updateData((current) => ({ ...current, aiMessages: [] }));
  }

  function addSportEntry() {
    if (!sportDraft.activity.trim()) return;
    updateData((current) => ({
      ...current,
      sports: [{ ...sportDraft, id: crypto.randomUUID(), activity: sportDraft.activity.trim() }, ...current.sports],
    }));
    setSportDraft({ ...sportDraft, activity: "", notes: "" });
  }

  function deleteSportEntry(id: string) {
    updateData((current) => ({ ...current, sports: current.sports.filter((entry) => entry.id !== id) }));
  }

  function patchMeal(patch: Partial<MealLog>) {
    updateData((current) => ({
      ...current,
      meals: { ...current.meals, [selectedDate]: { ...meal, ...patch, date: selectedDate } },
    }));
  }

  function patchWorkout(patch: Partial<WorkoutLog>) {
    updateData((current) => ({
      ...current,
      workouts: { ...current.workouts, [selectedDate]: { ...workout, ...patch, date: selectedDate } },
    }));
  }

  function patchNote(patch: Partial<DailyNote>) {
    updateData((current) => ({
      ...current,
      notes: { ...current.notes, [selectedDate]: { ...note, ...patch, date: selectedDate } },
    }));
  }

  function addRoutineItem() {
    if (!routineDraft.title.trim()) return;
    updateData((current) => ({
      ...current,
      routine: [
        ...current.routine,
        { id: crypto.randomUUID(), ...routineDraft, title: routineDraft.title.trim() },
      ].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start)),
    }));
    setRoutineDraft({ ...routineDraft, title: "" });
  }

  function deleteRoutineItem(id: string) {
    updateData((current) => ({ ...current, routine: current.routine.filter((item) => item.id !== id) }));
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `agenda-tue-${todayKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setData(normalizeData(JSON.parse(String(reader.result)) as Partial<AgendaData>));
      } catch {
        alert("No he podido leer ese archivo JSON.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  async function signIn() {
    if (!supabase || !authDraft.email.trim() || !authDraft.password.trim()) return;
    setAuthLoading(true);
    setSyncStatus("Iniciando sesión...");
    const { error } = await supabase.auth.signInWithPassword({
      email: authDraft.email.trim(),
      password: authDraft.password,
    });
    setAuthLoading(false);
    setSyncStatus(error ? `Login: ${error.message}` : "Sesión iniciada");
  }

  async function signUp() {
    if (!supabase || !authDraft.email.trim() || !authDraft.password.trim()) return;
    setAuthLoading(true);
    setSyncStatus("Creando cuenta...");
    const { error } = await supabase.auth.signUp({
      email: authDraft.email.trim(),
      password: authDraft.password,
    });
    setAuthLoading(false);
    setSyncStatus(error ? `Registro: ${error.message}` : "Cuenta creada. Revisa tu email si Supabase pide confirmación.");
  }

  async function signOut() {
    if (!supabase) return;
    setAuthLoading(true);
    await supabase.auth.signOut();
    setAuthLoading(false);
    setCloudReady(false);
    setSyncStatus("Sin iniciar sesión");
  }

  const navItems: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "calendar", label: "Calendario", icon: CalendarDays },
    { id: "courses", label: "Asignaturas", icon: Layers },
    { id: "sport", label: "Deporte", icon: Dumbbell },
    { id: "platforms", label: "Platforms", icon: Globe },
    { id: "ai", label: "IA", icon: Bot },
    { id: "day", label: "Día", icon: ClipboardList },
  ];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">TU/e</span>
          <div>
            <strong>Agenda personal</strong>
            <span>Mechanical Energy</span>
          </div>
        </div>
        <AuthPanel
          session={session}
          draft={authDraft}
          setDraft={setAuthDraft}
          loading={authLoading}
          syncStatus={syncStatus}
          signIn={signIn}
          signUp={signUp}
          signOut={signOut}
        />
        <nav className="nav-list" aria-label="Vistas principales">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="backup-tools">
          <button title="Exportar copia JSON" onClick={exportData}>
            <Download size={17} />
            Exportar
          </button>
          <button title="Importar copia JSON" onClick={() => importInput.current?.click()}>
            <Upload size={17} />
            Importar
          </button>
          <input ref={importInput} type="file" accept="application/json" onChange={importData} />
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Semana de {formatDate(weekStart, "short")}</span>
            <h1>{viewTitle(view)}</h1>
          </div>
          <div className="date-switcher">
            <button title="Día anterior" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>
              <ChevronLeft size={18} />
            </button>
            <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            <button title="Día siguiente" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
              <ChevronRight size={18} />
            </button>
          </div>
        </header>

        {view === "dashboard" && (
          <Dashboard
            selectedDate={selectedDate}
            weekDays={weekDays}
            tasks={weekTasks}
            events={weekEvents}
            sports={weekSports}
            calendars={data.courseCalendars}
            stats={stats}
            onOpenCalendar={() => setView("calendar")}
            onOpenDay={(day) => {
              setSelectedDate(day);
              setView("day");
            }}
            onToggleTask={(task) => patchTask(task.id, { completed: !task.completed })}
          />
        )}

        {view === "calendar" && (
          <CalendarView
            selectedDate={selectedDate}
            weekDays={weekDays}
            events={data.events}
            calendars={data.courseCalendars}
            draft={eventDraft}
            setDraft={setEventDraft}
            addEvent={addEvent}
            copyClassesFromPreviousWeek={copyClassesFromPreviousWeek}
            deleteEvent={deleteEvent}
          />
        )}

        {view === "courses" && (
          <CoursesView
            calendars={data.courseCalendars}
            events={data.events}
            draft={courseDraft}
            setDraft={setCourseDraft}
            addCourseCalendar={addCourseCalendar}
            patchCourseCalendar={patchCourseCalendar}
            deleteCourseCalendar={deleteCourseCalendar}
          />
        )}

        {view === "sport" && (
          <SportView
            weekDays={weekDays}
            sports={data.sports}
            draft={sportDraft}
            setDraft={setSportDraft}
            addSportEntry={addSportEntry}
            deleteSportEntry={deleteSportEntry}
          />
        )}

        {view === "platforms" && (
          <PlatformsView />
        )}

        {view === "ai" && (
          <AiView
            selectedDate={selectedDate}
            weekDays={weekDays}
            tasks={data.tasks}
            events={data.events}
            calendars={data.courseCalendars}
            notes={data.notes}
            messages={data.aiMessages}
            draft={aiDraft}
            setDraft={setAiDraft}
            apiKey={aiApiKey}
            setApiKey={setAiApiKey}
            model={aiModel}
            setModel={setAiModel}
            loading={aiLoading}
            sendMessage={sendAiMessage}
            clearChat={clearAiChat}
          />
        )}

        {view === "day" && (
          <DayView
            selectedDate={selectedDate}
            tasks={selectedTasks}
            events={data.events.filter((event) => event.date === selectedDate)}
            calendars={data.courseCalendars}
            routine={data.routine.filter((item) => item.weekday === weekdayIndex(selectedDate))}
            sports={data.sports.filter((entry) => entry.date === selectedDate)}
            meal={meal}
            workout={workout}
            note={note}
            taskDraft={taskDraft}
            setTaskDraft={setTaskDraft}
            addTask={() => addTask(selectedDate)}
            patchTask={patchTask}
            deleteTask={deleteTask}
            patchMeal={patchMeal}
            patchWorkout={patchWorkout}
            patchNote={patchNote}
          />
        )}

      </section>
    </main>
  );
}

function AuthPanel({
  session,
  draft,
  setDraft,
  loading,
  syncStatus,
  signIn,
  signUp,
  signOut,
}: {
  session: AuthSession | null;
  draft: { email: string; password: string };
  setDraft: (draft: { email: string; password: string }) => void;
  loading: boolean;
  syncStatus: string;
  signIn: () => void;
  signUp: () => void;
  signOut: () => void;
}) {
  if (!hasSupabaseConfig) {
    return (
      <section className="auth-panel offline">
        <div className="sync-line">
          <CloudOff size={16} />
          <span>Login sin configurar</span>
        </div>
        <small>Añade tus claves de Supabase para sincronizar móvil y ordenador.</small>
      </section>
    );
  }

  if (session) {
    return (
      <section className="auth-panel signed-in">
        <div className="sync-line">
          <Cloud size={16} />
          <span>{syncStatus}</span>
        </div>
        <strong>{session.user.email}</strong>
        <button className="secondary-action compact-action" onClick={signOut} disabled={loading}>
          <LogOut size={16} />
          Salir
        </button>
      </section>
    );
  }

  return (
    <section className="auth-panel">
      <div className="sync-line">
        <CloudOff size={16} />
        <span>{syncStatus}</span>
      </div>
      <input
        type="email"
        value={draft.email}
        placeholder="Email"
        onChange={(event) => setDraft({ ...draft, email: event.target.value })}
      />
      <input
        type="password"
        value={draft.password}
        placeholder="Contraseña"
        onChange={(event) => setDraft({ ...draft, password: event.target.value })}
      />
      <div className="auth-actions">
        <button className="primary" onClick={signIn} disabled={loading}>
          <LogIn size={16} />
          Entrar
        </button>
        <button className="secondary-action compact-action" onClick={signUp} disabled={loading}>
          Crear
        </button>
      </div>
    </section>
  );
}

function viewTitle(view: View) {
  return {
    dashboard: "Dashboard semanal",
    calendar: "Calendario semanal",
    courses: "Calendarios de asignaturas",
    sport: "Deporte",
    platforms: "Platforms",
    ai: "Preguntas de IA",
    day: "Plan del día",
  }[view];
}

function Dashboard({
  selectedDate,
  weekDays,
  tasks,
  events,
  sports,
  calendars,
  stats,
  onOpenCalendar,
  onOpenDay,
  onToggleTask,
}: {
  selectedDate: string;
  weekDays: string[];
  tasks: Task[];
  events: CalendarEvent[];
  sports: SportEntry[];
  calendars: CourseCalendar[];
  stats: { openTasks: Task[]; urgentTasks: Task[]; completedThisWeek: number; sportMinutes: number };
  onOpenCalendar: () => void;
  onOpenDay: (day: string) => void;
  onToggleTask: (task: Task) => void;
}) {
  const urgentTasks = tasks
    .filter((task) => !task.completed && task.priority !== "normal")
    .sort((a, b) => a.date.localeCompare(b.date) || priorityRank(a.priority) - priorityRank(b.priority))
    .slice(0, 6);
  const dayTasks = tasks
    .filter((task) => task.date === selectedDate && !task.completed)
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
  const todayEvents = events.filter((event) => event.date === todayKey()).length;
  const todayTasks = tasks.filter((task) => task.date === todayKey() && !task.completed).length;
  return (
    <div className="dashboard-grid">
      <section className="welcome-panel">
        <div>
          <span>Hoy es {formatDate(todayKey())}</span>
          <h2>Bienvenido, Juan</h2>
        </div>
        <strong>{todayEvents} eventos · {todayTasks} tareas pendientes</strong>
      </section>

      <section className="summary-band">
        <Metric label="Tareas abiertas" value={stats.openTasks.length} />
        <Metric label="Eventos semana" value={events.length} />
        <Metric label="Exámenes/deadlines/lab" value={stats.urgentTasks.length} />
        <Metric label="Min deporte" value={stats.sportMinutes} />
      </section>

      <section className="panel wide">
        <PanelHeader icon={CalendarDays} title="Semana tipo calendario" />
        <div className="week-strip">
          {weekDays.map((day) => {
            const dayEvents = events.filter((event) => event.date === day);
            const daySports = sports.filter((entry) => entry.date === day);
            return (
              <button
                key={day}
                className={`day-tile${day === selectedDate ? " selected" : ""}${day === todayKey() ? " today" : ""}`}
                onClick={() => onOpenDay(day)}
              >
                <span>{weekdays[weekdayIndex(day)]}</span>
                <strong>{fromDateKey(day).getDate()}</strong>
                <small>{dayEvents.length} eventos · {daySports.length} deporte</small>
              </button>
            );
          })}
        </div>
        <button className="secondary-action" onClick={onOpenCalendar}>
          <CalendarDays size={17} />
          Abrir calendario semanal
        </button>
      </section>

      <section className="panel">
        <PanelHeader icon={Layers} title="Asignaturas" />
        <div className="calendar-list">
          {calendars.map((calendar) => (
            <div key={calendar.id} className="legend-row">
              <i style={{ background: calendar.color }} />
              <span>{calendar.name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <PanelHeader icon={ClipboardList} title="Próximo foco" />
        <div className="task-stack">
          {urgentTasks.length === 0 ? <Empty text="Sin deadlines, exams o labs pendientes esta semana." /> : urgentTasks.map((task) => (
            <TaskRow key={task.id} task={task} onToggle={() => onToggleTask(task)} compact />
          ))}
        </div>
      </section>

      <section className="panel">
        <PanelHeader icon={Check} title="Tareas del día" />
        <div className="task-stack">
          {dayTasks.length === 0 ? <Empty text="Sin tareas pendientes para este día." /> : dayTasks.map((task) => (
            <TaskRow key={task.id} task={task} onToggle={() => onToggleTask(task)} compact />
          ))}
        </div>
      </section>

    </div>
  );
}

function CalendarView({
  selectedDate,
  weekDays,
  events,
  calendars,
  draft,
  setDraft,
  addEvent,
  copyClassesFromPreviousWeek,
  deleteEvent,
}: {
  selectedDate: string;
  weekDays: string[];
  events: CalendarEvent[];
  calendars: CourseCalendar[];
  draft: Omit<CalendarEvent, "id">;
  setDraft: (draft: Omit<CalendarEvent, "id">) => void;
  addEvent: () => void;
  copyClassesFromPreviousWeek: () => void;
  deleteEvent: (id: string) => void;
}) {
  const [mode, setMode] = useState<"day" | "week" | "month">("week");
  const dayEvents = events.filter((event) => event.date === selectedDate);
  const weekEvents = events.filter((event) => weekDays.includes(event.date));
  const monthDays = monthGridDays(selectedDate);
  const selectedMonth = fromDateKey(selectedDate).getMonth();
  const monthLabel = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(fromDateKey(selectedDate));

  return (
    <div className="calendar-layout">
      <section className="panel wide">
        <PanelHeader icon={Plus} title="Añadir evento al calendario" />
        <div className="event-form">
          <input value={draft.title} placeholder="Clase, práctica, deadline..." onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          <input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
          <input type="time" value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} />
          <input type="time" value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} />
          <select value={draft.calendarId} onChange={(event) => setDraft({ ...draft, calendarId: event.target.value })}>
            {calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}
          </select>
          <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as EventType })}>
            <option value="clase">clase</option>
            <option value="estudio">estudio</option>
            <option value="deadline">deadline</option>
            <option value="exam">exam</option>
            <option value="work">work</option>
            <option value="tarea">tarea</option>
            <option value="personal">personal</option>
          </select>
          <button className="primary" onClick={addEvent}>
            <Plus size={18} />
            Añadir
          </button>
        </div>
        <div className="event-type-legend">
          {(Object.keys(eventTypeStyles) as EventType[]).map((type) => (
            <span key={type} style={{ borderColor: eventTypeStyles[type].color, background: eventTypeStyles[type].background }}>
              {eventTypeStyles[type].label}
            </span>
          ))}
        </div>
        <button className="secondary-action" onClick={copyClassesFromPreviousWeek}>
          <RefreshCw size={17} />
          Copiar clases semana anterior
        </button>
      </section>

      <section className="panel wide">
        <div className="calendar-toolbar">
          <div>
            <h2>{mode === "day" ? formatDate(selectedDate) : mode === "week" ? "Semana" : monthLabel}</h2>
            <span>{mode === "day" ? "Vista del d?a seleccionado" : mode === "week" ? "Vista por horas" : "Vista del mes completo"}</span>
          </div>
          <div className="segmented-control" aria-label="Cambiar vista de calendario">
            <button className={mode === "day" ? "active" : ""} onClick={() => setMode("day")}>D?a</button>
            <button className={mode === "week" ? "active" : ""} onClick={() => setMode("week")}>Semana</button>
            <button className={mode === "month" ? "active" : ""} onClick={() => setMode("month")}>Mes</button>
          </div>
        </div>
      </section>

      <section className={mode === "day" ? "panel wide calendar-shell day-calendar-shell" : "panel wide calendar-shell day-calendar-shell hidden"}>
        <div className="day-calendar-head">
          <span />
          <button className={selectedDate === todayKey() ? "calendar-day-head today" : "calendar-day-head"}>
            <span>{weekdays[weekdayIndex(selectedDate)]}</span>
            <strong>{fromDateKey(selectedDate).getDate()}</strong>
          </button>
        </div>
        <div className="day-calendar-body">
          <div className="hour-axis">
            {hours.map((hour) => <span key={hour}>{String(hour).padStart(2, "0")}:00</span>)}
          </div>
          <div className={selectedDate === todayKey() ? "calendar-column today" : "calendar-column"}>
            {hours.map((hour) => <div key={hour} className="hour-line" />)}
            {dayEvents.map((event) => {
              const calendar = calendars.find((item) => item.id === event.calendarId);
              const typeStyle = eventTypeStyles[event.type];
              const position = eventPosition(event);
              return (
                <article
                  key={event.id}
                  className={`calendar-event ${event.type}`}
                  style={{
                    top: position.top,
                    height: position.height,
                    borderColor: typeStyle.color,
                    background: typeStyle.background,
                  }}
                >
                  <strong>{event.title}</strong>
                  <span>{event.start} - {event.end}</span>
                  <small>{typeStyle.label} ? {calendar?.name ?? "General"}</small>
                  <button title="Eliminar evento" onClick={() => deleteEvent(event.id)}>
                    <Trash2 size={14} />
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className={mode === "week" ? "panel wide calendar-shell" : "panel wide calendar-shell hidden"}>
        <div className="calendar-head">
          <span />
          {weekDays.map((day) => (
                <button key={day} className={day === todayKey() ? "calendar-day-head today" : "calendar-day-head"}>
              <span>{weekdays[weekdayIndex(day)]}</span>
              <strong>{fromDateKey(day).getDate()}</strong>
            </button>
          ))}
        </div>
        <div className="calendar-body">
          <div className="hour-axis">
            {hours.map((hour) => <span key={hour}>{String(hour).padStart(2, "0")}:00</span>)}
          </div>
          {weekDays.map((day) => (
                <div key={day} className={day === todayKey() ? "calendar-column today" : "calendar-column"}>
              {hours.map((hour) => <div key={hour} className="hour-line" />)}
              {weekEvents.filter((event) => event.date === day).map((event) => {
                const calendar = calendars.find((item) => item.id === event.calendarId);
                const typeStyle = eventTypeStyles[event.type];
                const position = eventPosition(event);
                return (
                  <article
                    key={event.id}
                    className={`calendar-event ${event.type}`}
                    style={{
                      top: position.top,
                      height: position.height,
                      borderColor: typeStyle.color,
                      background: typeStyle.background,
                    }}
                  >
                    <strong>{event.title}</strong>
                    <span>{event.start} - {event.end}</span>
                    <small>{typeStyle.label} · {calendar?.name ?? "General"}</small>
                    <button title="Eliminar evento" onClick={() => deleteEvent(event.id)}>
                      <Trash2 size={14} />
                    </button>
                  </article>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <section className={mode === "month" ? "panel wide month-shell" : "panel wide month-shell hidden"}>
        <div className="month-weekdays">
          {weekdays.map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="month-grid">
          {monthDays.map((day) => {
            const dayEvents = events.filter((event) => event.date === day);
            const isOutsideMonth = fromDateKey(day).getMonth() !== selectedMonth;
            return (
                  <section key={day} className={`${isOutsideMonth ? "month-day outside" : "month-day"}${day === todayKey() ? " today" : ""}`}>
                <header>
                  <strong>{fromDateKey(day).getDate()}</strong>
                  <span>{formatDate(day, "short")}</span>
                </header>
                <div className="month-events">
                  {dayEvents.slice(0, 4).map((event) => {
                    const calendar = calendars.find((item) => item.id === event.calendarId);
                    const typeStyle = eventTypeStyles[event.type];
                    return (
                      <article
                        key={event.id}
                        className="month-event"
                        style={{ borderColor: typeStyle.color, background: typeStyle.background }}
                      >
                        <strong>{event.title}</strong>
                        <span>{event.start} · {typeStyle.label} · {calendar?.name ?? "General"}</span>
                        <button title="Eliminar evento" onClick={() => deleteEvent(event.id)}>
                          <Trash2 size={13} />
                        </button>
                      </article>
                    );
                  })}
                  {dayEvents.length > 4 && <small>+{dayEvents.length - 4} más</small>}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function priorityRank(priority: Priority) {
  return { exam: 0, deadline: 1, lab: 2, normal: 3 }[priority];
}

function CoursesView({
  calendars,
  events,
  draft,
  setDraft,
  addCourseCalendar,
  patchCourseCalendar,
  deleteCourseCalendar,
}: {
  calendars: CourseCalendar[];
  events: CalendarEvent[];
  draft: Omit<CourseCalendar, "id">;
  setDraft: (draft: Omit<CourseCalendar, "id">) => void;
  addCourseCalendar: () => void;
  patchCourseCalendar: (id: string, patch: Partial<CourseCalendar>) => void;
  deleteCourseCalendar: (id: string) => void;
}) {
  return (
    <div className="courses-layout">
      <section className="panel wide">
        <PanelHeader icon={Layers} title="Añadir calendario de clase" />
        <div className="course-form">
          <input value={draft.name} placeholder="Nombre de la asignatura" onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          <input value={draft.location} placeholder="Aula / campus" onChange={(event) => setDraft({ ...draft, location: event.target.value })} />
          <select value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })}>
            {colors.map((color) => <option key={color} value={color}>{color}</option>)}
          </select>
          <button className="primary" onClick={addCourseCalendar}>
            <Plus size={18} />
            Añadir
          </button>
        </div>
      </section>

      <section className="course-grid">
        {calendars.map((calendar) => (
          <article key={calendar.id} className="panel course-card" style={{ borderTopColor: calendar.color }}>
            <div className="course-card-head">
              <span className="color-dot" style={{ background: calendar.color }} />
              <input value={calendar.name} onChange={(event) => patchCourseCalendar(calendar.id, { name: event.target.value })} />
              <button title="Eliminar calendario" onClick={() => deleteCourseCalendar(calendar.id)}>
                <Trash2 size={16} />
              </button>
            </div>
            <Field label="Lugar" value={calendar.location} onChange={(value) => patchCourseCalendar(calendar.id, { location: value })} />
            <label className="field">
              <span>Notas</span>
              <textarea value={calendar.notes} onChange={(event) => patchCourseCalendar(calendar.id, { notes: event.target.value })} placeholder="Profesor, grupo, links, cosas importantes..." />
            </label>
            <small>{events.filter((event) => event.calendarId === calendar.id).length} eventos vinculados</small>
          </article>
        ))}
      </section>
    </div>
  );
}

function PlatformsView() {
  return (
    <div className="platforms-layout">
      <section className="panel wide">
        <PanelHeader icon={Globe} title="Accesos rápidos" />
        <div className="platform-grid">
          {platforms.map((platform) => (
            <a key={platform.name} className="platform-card" href={platform.url} target="_blank" rel="noreferrer">
              <img
                src={platform.logo ?? `https://www.google.com/s2/favicons?domain=${platform.domain}&sz=64`}
                alt=""
                loading="lazy"
              />
              <div>
                <strong>{platform.name}</strong>
                <span>{platform.description}</span>
                <small>{platform.domain}</small>
              </div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

function AiView({
  selectedDate,
  weekDays,
  tasks,
  events,
  calendars,
  notes,
  messages,
  draft,
  setDraft,
  apiKey,
  setApiKey,
  model,
  setModel,
  loading,
  sendMessage,
  clearChat,
}: {
  selectedDate: string;
  weekDays: string[];
  tasks: Task[];
  events: CalendarEvent[];
  calendars: CourseCalendar[];
  notes: Record<string, DailyNote>;
  messages: AiChatMessage[];
  draft: string;
  setDraft: (value: string) => void;
  apiKey: string;
  setApiKey: (value: string) => void;
  model: string;
  setModel: (value: string) => void;
  loading: boolean;
  sendMessage: () => void;
  clearChat: () => void;
}) {
  const selectedDayTasks = tasks.filter((task) => task.date === selectedDate && !task.completed);
  const selectedDayEvents = events.filter((event) => event.date === selectedDate);
  const weekUrgent = tasks.filter((task) => weekDays.includes(task.date) && !task.completed && task.priority !== "normal");
  const contextPrompt = buildAiPrompt({
    selectedDate,
    draft,
    tasks: selectedDayTasks,
    events: selectedDayEvents,
    urgentTasks: weekUrgent,
    calendars,
    note: notes[selectedDate],
  });

  return (
    <div className="ai-layout">
      <section className="panel wide ai-panel">
        <PanelHeader icon={Bot} title="Chat IA" />
        <div className="ai-settings">
          <label className="field">
            <span>OpenAI API key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-..."
            />
          </label>
          <label className="field">
            <span>Modelo</span>
            <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="gpt-5.2" />
          </label>
        </div>

        <div className="chat-window" aria-live="polite">
          {messages.length === 0 ? (
            <Empty text="Empieza preguntando algo: recetas, ideas de comida, estudio, deporte o planificación." />
          ) : messages.map((message) => (
            <article key={message.id} className={`chat-message ${message.role}`}>
              <strong>{message.role === "user" ? "Juan" : "IA"}</strong>
              <p>{message.content}</p>
            </article>
          ))}
          {loading && <article className="chat-message assistant"><strong>IA</strong><p>Pensando...</p></article>}
        </div>

        <label className="field">
          <span>Mensaje</span>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) sendMessage();
            }}
            placeholder="Ej. Dame una receta fácil con pasta, atún y tomate..."
          />
        </label>
        <div className="ai-actions">
          <button className="primary" onClick={sendMessage} disabled={loading || !apiKey.trim()}>
            <Send size={18} />
            {loading ? "Enviando..." : "Enviar"}
          </button>
          <button className="secondary-action" onClick={clearChat}>
            <Trash2 size={17} />
            Limpiar chat
          </button>
        </div>
      </section>

      <section className="panel">
        <PanelHeader icon={ClipboardList} title="Contexto de tu agenda" />
        <pre className="ai-preview">{contextPrompt}</pre>
      </section>
    </div>
  );
}
function buildAiPrompt({
  selectedDate,
  draft,
  tasks,
  events,
  urgentTasks,
  calendars,
  note,
}: {
  selectedDate: string;
  draft: string;
  tasks: Task[];
  events: CalendarEvent[];
  urgentTasks: Task[];
  calendars: CourseCalendar[];
  note?: DailyNote;
}) {
  const eventLines = events.map((event) => {
    const calendar = calendars.find((item) => item.id === event.calendarId);
    return `- ${event.start}-${event.end}: ${event.title} (${eventTypeStyles[event.type].label}, ${calendar?.name ?? "General"})`;
  });
  const taskLines = tasks.map((task) => `- ${task.title} (${task.priority}, ${task.category})`);
  const urgentLines = urgentTasks.map((task) => `- ${task.date}: ${task.title} (${task.priority})`);

  return [
    "Soy Juan, estudiante de Mechanical/Energy en TU/e Eindhoven.",
    `Fecha seleccionada: ${formatDate(selectedDate)}.`,
    "",
    `Pregunta: ${draft || "Ayúdame con mi planificación."}`,
    "",
    "Eventos del día:",
    eventLines.length ? eventLines.join("\n") : "- Sin eventos.",
    "",
    "Tareas pendientes del día:",
    taskLines.length ? taskLines.join("\n") : "- Sin tareas pendientes.",
    "",
    "Deadlines/exams/labs pendientes de la semana:",
    urgentLines.length ? urgentLines.join("\n") : "- Sin urgentes pendientes.",
    "",
    "Notas del día:",
    note?.text || note?.studyFocus ? `- Focus: ${note.studyFocus || "sin focus"}\n- Nota: ${note.text || "sin nota"}` : "- Sin notas.",
  ].join("\n");
}

function extractResponseText(result: unknown) {
  if (typeof result === "object" && result !== null && "output_text" in result && typeof result.output_text === "string") {
    return result.output_text;
  }

  const output = (result as { output?: Array<{ content?: Array<{ text?: string }> }> }).output;
  const text = output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter(Boolean)
    .join("\n");

  return text || "No he recibido texto en la respuesta.";
}

function SportView({
  weekDays,
  sports,
  draft,
  setDraft,
  addSportEntry,
  deleteSportEntry,
}: {
  weekDays: string[];
  sports: SportEntry[];
  draft: Omit<SportEntry, "id">;
  setDraft: (draft: Omit<SportEntry, "id">) => void;
  addSportEntry: () => void;
  deleteSportEntry: (id: string) => void;
}) {
  const weekSports = sports.filter((entry) => weekDays.includes(entry.date));
  const minutes = weekSports.reduce((sum, entry) => sum + entry.duration, 0);
  return (
    <div className="sport-layout">
      <section className="summary-band">
        <Metric label="Sesiones semana" value={weekSports.length} />
        <Metric label="Minutos semana" value={minutes} />
        <Metric label="Alta intensidad" value={weekSports.filter((entry) => entry.intensity === "alta").length} />
        <Metric label="Tipos distintos" value={new Set(weekSports.map((entry) => entry.type)).size} />
      </section>

      <section className="panel wide">
        <PanelHeader icon={Dumbbell} title="Añadir deporte" />
        <div className="sport-form">
          <input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
          <input value={draft.type} placeholder="Tipo: gym, running, fútbol..." onChange={(event) => setDraft({ ...draft, type: event.target.value })} />
          <input value={draft.activity} placeholder="Qué hiciste" onChange={(event) => setDraft({ ...draft, activity: event.target.value })} />
          <input type="number" min="0" value={draft.duration} onChange={(event) => setDraft({ ...draft, duration: Number(event.target.value) })} />
          <select value={draft.intensity} onChange={(event) => setDraft({ ...draft, intensity: event.target.value as Intensity })}>
            <option value="suave">suave</option>
            <option value="media">media</option>
            <option value="alta">alta</option>
          </select>
          <button className="primary" onClick={addSportEntry}>
            <Plus size={18} />
            Añadir
          </button>
        </div>
        <Field label="Notas del entreno" value={draft.notes} onChange={(value) => setDraft({ ...draft, notes: value })} />
      </section>

      <section className="panel wide">
        <PanelHeader icon={Activity} title="Registro de deporte" />
        <div className="sport-list">
          {sports.length === 0 ? <Empty text="Aún no hay deporte añadido." /> : sports.map((entry) => (
            <article key={entry.id} className="sport-entry">
              <div>
                <strong>{entry.activity}</strong>
                <span>{formatDate(entry.date, "short")} · {entry.type} · {entry.duration} min · {entry.intensity}</span>
                {entry.notes && <small>{entry.notes}</small>}
              </div>
              <button title="Eliminar deporte" onClick={() => deleteSportEntry(entry.id)}>
                <Trash2 size={16} />
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function DayView({
  selectedDate,
  tasks,
  events,
  calendars,
  routine,
  sports,
  meal,
  workout,
  note,
  taskDraft,
  setTaskDraft,
  addTask,
  patchTask,
  deleteTask,
  patchMeal,
  patchWorkout,
  patchNote,
}: {
  selectedDate: string;
  tasks: Task[];
  events: CalendarEvent[];
  calendars: CourseCalendar[];
  routine: RoutineItem[];
  sports: SportEntry[];
  meal: MealLog;
  workout: WorkoutLog;
  note: DailyNote;
  taskDraft: { title: string; priority: Priority; category: TaskCategory };
  setTaskDraft: (draft: { title: string; priority: Priority; category: TaskCategory }) => void;
  addTask: () => void;
  patchTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  patchMeal: (patch: Partial<MealLog>) => void;
  patchWorkout: (patch: Partial<WorkoutLog>) => void;
  patchNote: (patch: Partial<DailyNote>) => void;
}) {
  return (
    <div className="day-layout">
      <section className="panel wide">
        <PanelHeader icon={CalendarDays} title={formatDate(selectedDate)} />
        <div className="routine-timeline">
          {events.map((event) => {
            const calendar = calendars.find((item) => item.id === event.calendarId);
            return (
              <div key={event.id} className="routine-pill" style={{ borderColor: calendar?.color }}>
                <span>{event.start} - {event.end}</span>
                <strong>{event.title}</strong>
                <small>{calendar?.name ?? event.type}</small>
              </div>
            );
          })}
          {routine.map((item) => (
            <div key={item.id} className={`routine-pill ${item.type}`}>
              <span>{item.start} - {item.end}</span>
              <strong>{item.title}</strong>
              <small>{item.type}</small>
            </div>
          ))}
          {events.length === 0 && routine.length === 0 && <Empty text="No hay eventos ni bloques de rutina para este día." />}
        </div>
      </section>

      <section className="panel wide">
        <PanelHeader icon={ClipboardList} title="Tasks" />
        <div className="add-line">
          <input value={taskDraft.title} placeholder="Nueva tarea, deadline o lab..." onChange={(event) => setTaskDraft({ ...taskDraft, title: event.target.value })} onKeyDown={(event) => event.key === "Enter" && addTask()} />
          <select value={taskDraft.priority} onChange={(event) => setTaskDraft({ ...taskDraft, priority: event.target.value as Priority })}>
            <option value="normal">normal</option>
            <option value="deadline">deadline</option>
            <option value="exam">exam</option>
            <option value="lab">lab</option>
          </select>
          <select value={taskDraft.category} onChange={(event) => setTaskDraft({ ...taskDraft, category: event.target.value as TaskCategory })}>
            <option value="estudio">estudio</option>
            <option value="personal">personal</option>
            <option value="admin">admin</option>
            <option value="salud">salud</option>
          </select>
          <button className="primary icon-only" title="Añadir tarea" onClick={addTask}>
            <Plus size={18} />
          </button>
        </div>
        <div className="task-stack">
          {tasks.length === 0 ? <Empty text="Nada pendiente para este día." /> : tasks.map((task) => (
            <TaskEditor key={task.id} task={task} patchTask={patchTask} deleteTask={deleteTask} />
          ))}
        </div>
      </section>

      <section className="panel">
        <PanelHeader icon={Soup} title="Comida" />
        <Field label="Desayuno" value={meal.breakfast} onChange={(value) => patchMeal({ breakfast: value })} />
        <Field label="Comida" value={meal.lunch} onChange={(value) => patchMeal({ lunch: value })} />
        <Field label="Cena" value={meal.dinner} onChange={(value) => patchMeal({ dinner: value })} />
        <Field label="Snacks" value={meal.snacks} onChange={(value) => patchMeal({ snacks: value })} />
      </section>

      <section className="panel">
        <PanelHeader icon={Dumbbell} title="Deporte del día" />
        <Field label="Actividad rápida" value={workout.activity} onChange={(value) => patchWorkout({ activity: value })} />
        <label className="field">
          <span>Duración</span>
          <input type="number" min="0" value={workout.duration} onChange={(event) => patchWorkout({ duration: Number(event.target.value) })} />
        </label>
        <label className="field">
          <span>Intensidad</span>
          <select value={workout.intensity} onChange={(event) => patchWorkout({ intensity: event.target.value as Intensity })}>
            <option value="suave">suave</option>
            <option value="media">media</option>
            <option value="alta">alta</option>
          </select>
        </label>
        <div className="mini-section">
          <b>Registro detallado</b>
          {sports.length === 0 ? <small>Sin sesiones añadidas.</small> : sports.map((entry) => (
            <span key={entry.id} className="mini-task">{entry.activity} · {entry.duration} min</span>
          ))}
        </div>
      </section>

      <section className="panel wide">
        <PanelHeader icon={Save} title="Study focus y notas" />
        <Field label="Study focus" value={note.studyFocus} onChange={(value) => patchNote({ studyFocus: value })} placeholder="Ej. Signals, Energy Storage, Etchis..." />
        <div className="split-fields">
          <label className="field">
            <span>Energía</span>
            <input type="range" min="1" max="5" value={note.energy} onChange={(event) => patchNote({ energy: Number(event.target.value) })} />
          </label>
          <label className="field">
            <span>Sueño</span>
            <input type="number" min="0" max="12" value={note.sleep ?? 0} onChange={(event) => patchNote({ sleep: Number(event.target.value) })} />
          </label>
          <Field label="Ánimo" value={note.mood} onChange={(value) => patchNote({ mood: value })} />
        </div>
        <label className="field">
          <span>Notas del día</span>
          <textarea value={note.text} onChange={(event) => patchNote({ text: event.target.value })} placeholder="Qué salió bien, qué revisar mañana, ideas..." />
        </label>
      </section>
    </div>
  );
}

function RoutineView({
  routine,
  draft,
  setDraft,
  addRoutineItem,
  deleteRoutineItem,
}: {
  routine: RoutineItem[];
  draft: { weekday: number; start: string; end: string; type: RoutineType; title: string };
  setDraft: (draft: { weekday: number; start: string; end: string; type: RoutineType; title: string }) => void;
  addRoutineItem: () => void;
  deleteRoutineItem: (id: string) => void;
}) {
  return (
    <div className="routine-layout">
      <section className="panel wide">
        <PanelHeader icon={RefreshCw} title="Añadir bloque fijo" />
        <div className="routine-form">
          <select value={draft.weekday} onChange={(event) => setDraft({ ...draft, weekday: Number(event.target.value) })}>
            {fullWeekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}
          </select>
          <input type="time" value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} />
          <input type="time" value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} />
          <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as RoutineType })}>
            <option value="clase">clase</option>
            <option value="estudio">estudio</option>
            <option value="deporte">deporte</option>
            <option value="personal">personal</option>
          </select>
          <input value={draft.title} placeholder="Ej. Dynamics lecture, gym, MATLAB lab..." onChange={(event) => setDraft({ ...draft, title: event.target.value })} onKeyDown={(event) => event.key === "Enter" && addRoutineItem()} />
          <button className="primary" onClick={addRoutineItem}>
            <Plus size={18} />
            Añadir
          </button>
        </div>
      </section>

      <section className="panel wide">
        <PanelHeader icon={CalendarDays} title="Tu rutina semanal" />
        <div className="routine-board">
          {fullWeekdays.map((day, index) => (
            <div key={day} className="routine-day">
              <strong>{day}</strong>
              {routine.filter((item) => item.weekday === index).length === 0 ? <small>Sin bloques</small> : routine
                .filter((item) => item.weekday === index)
                .map((item) => (
                  <div key={item.id} className={`routine-card ${item.type}`}>
                    <span>{item.start} - {item.end}</span>
                    <b>{item.title}</b>
                    <button title="Eliminar bloque" onClick={() => deleteRoutineItem(item.id)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PanelHeader({ icon: Icon, title }: { icon: typeof CalendarDays; title: string }) {
  return (
    <div className="panel-header">
      <Icon size={18} />
      <h2>{title}</h2>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="empty">{text}</p>;
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TaskRow({ task, onToggle, compact = false }: { task: Task; onToggle: () => void; compact?: boolean }) {
  return (
    <div className={task.completed ? "task-row done" : "task-row"}>
      <button className="check-button" title="Completar tarea" onClick={onToggle}>
        {task.completed && <Check size={14} />}
      </button>
      <div>
        <strong>{task.title}</strong>
        <span>{compact ? formatDate(task.date, "short") : task.category} · {task.priority}</span>
      </div>
    </div>
  );
}

function TaskEditor({
  task,
  patchTask,
  deleteTask,
}: {
  task: Task;
  patchTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
}) {
  return (
    <article className={task.completed ? "task-editor done" : "task-editor"}>
      <TaskRow task={task} onToggle={() => patchTask(task.id, { completed: !task.completed })} />
      <div className="task-controls">
        <select value={task.priority} onChange={(event) => patchTask(task.id, { priority: event.target.value as Priority })}>
          <option value="normal">normal</option>
          <option value="deadline">deadline</option>
          <option value="exam">exam</option>
          <option value="lab">lab</option>
        </select>
        <select value={task.category} onChange={(event) => patchTask(task.id, { category: event.target.value as TaskCategory })}>
          <option value="estudio">estudio</option>
          <option value="personal">personal</option>
          <option value="admin">admin</option>
          <option value="salud">salud</option>
        </select>
        <button title="Eliminar tarea" onClick={() => deleteTask(task.id)}>
          <Trash2 size={16} />
        </button>
      </div>
      <input value={task.notes} placeholder="Notas de la tarea..." onChange={(event) => patchTask(task.id, { notes: event.target.value })} />
    </article>
  );
}
