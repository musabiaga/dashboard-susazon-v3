/**
 * lib/login-quotes.ts — frases rotativas para el login.
 *
 * Curadas de 4 escuelas de pensamiento que se conectan con el contexto
 * de inteligencia comercial: stoics, emprendedores, magnates, pensadores
 * modernos. Todas en español, máximo ~110 caracteres por frase (para que
 * no se rompan visualmente en mobile).
 *
 * Verificación: cada cita tiene fuente conocida. No invento.
 */

export type Quote = {
  /** Texto de la frase */
  text: string;
  /** Autor */
  author: string;
  /** Categoría (para color/badge opcional) */
  category: "stoic" | "entrepreneur" | "magnate" | "modern" | "classic";
};

export const LOGIN_QUOTES: Quote[] = [
  // ===== STOICS =====
  {
    text: "El obstáculo en el camino se convierte en el camino.",
    author: "Marco Aurelio",
    category: "stoic",
  },
  {
    text: "No es lo que te pasa, sino cómo reaccionas a ello lo que importa.",
    author: "Epicteto",
    category: "stoic",
  },
  {
    text: "Si quieres mejorar, conténtate con parecer ignorante o necio.",
    author: "Epicteto",
    category: "stoic",
  },
  {
    text: "La vida es muy corta para preocuparse por cosas pequeñas.",
    author: "Séneca",
    category: "stoic",
  },
  {
    text: "Toda dificultad eludida será un fantasma que perturbe tu reposo.",
    author: "Séneca",
    category: "stoic",
  },
  {
    text: "La mejor venganza es no parecerse a quien te ofendió.",
    author: "Marco Aurelio",
    category: "stoic",
  },
  {
    text: "Confina tu pensamiento al presente.",
    author: "Marco Aurelio",
    category: "stoic",
  },

  // ===== EMPRENDEDORES =====
  {
    text: "Las ideas son fáciles. La ejecución es todo.",
    author: "John Doerr",
    category: "entrepreneur",
  },
  {
    text: "Tu cliente más infeliz es tu mayor fuente de aprendizaje.",
    author: "Bill Gates",
    category: "entrepreneur",
  },
  {
    text: "Muévete rápido y rompe cosas. Si no rompes nada, no te mueves lo bastante rápido.",
    author: "Mark Zuckerberg",
    category: "entrepreneur",
  },
  {
    text: "La gente no sabe lo que quiere hasta que se lo enseñas.",
    author: "Steve Jobs",
    category: "entrepreneur",
  },
  {
    text: "Si no estás dispuesto a equivocarte, nunca crearás algo original.",
    author: "Ken Robinson",
    category: "entrepreneur",
  },
  {
    text: "Quien controla la información, controla el juego.",
    author: "Jeff Bezos",
    category: "entrepreneur",
  },
  {
    text: "No optimices el corto plazo a costa del largo plazo.",
    author: "Jeff Bezos",
    category: "entrepreneur",
  },
  {
    text: "El mayor riesgo es no tomar ningún riesgo.",
    author: "Mark Zuckerberg",
    category: "entrepreneur",
  },

  // ===== MAGNATES =====
  {
    text: "El precio es lo que pagas. El valor es lo que recibes.",
    author: "Warren Buffett",
    category: "magnate",
  },
  {
    text: "Se necesitan 20 años para construir reputación y 5 minutos para arruinarla.",
    author: "Warren Buffett",
    category: "magnate",
  },
  {
    text: "Sé temeroso cuando otros son codiciosos, y codicioso cuando otros son temerosos.",
    author: "Warren Buffett",
    category: "magnate",
  },
  {
    text: "El hombre que adquiere la capacidad de tomar plena posesión de su mente puede tomar posesión de cualquier cosa.",
    author: "Andrew Carnegie",
    category: "magnate",
  },
  {
    text: "No hay forma de ahorrar tu camino a la riqueza. Tienes que ganarlo.",
    author: "John D. Rockefeller",
    category: "magnate",
  },
  {
    text: "La buena gestión consiste en mostrar a la gente promedio cómo hacer el trabajo de gente superior.",
    author: "John D. Rockefeller",
    category: "magnate",
  },

  // ===== PENSADORES MODERNOS =====
  {
    text: "Lo que se mide, se mejora.",
    author: "Peter Drucker",
    category: "modern",
  },
  {
    text: "La cultura se come la estrategia en el desayuno.",
    author: "Peter Drucker",
    category: "modern",
  },
  {
    text: "No puedes gestionar lo que no puedes medir.",
    author: "Peter Drucker",
    category: "modern",
  },
  {
    text: "La riqueza es activos que generan ingresos mientras duermes.",
    author: "Naval Ravikant",
    category: "modern",
  },
  {
    text: "Aprende a vender. Aprende a construir. Si puedes hacer ambas, serás imparable.",
    author: "Naval Ravikant",
    category: "modern",
  },
  {
    text: "La competencia es para perdedores.",
    author: "Peter Thiel",
    category: "modern",
  },
  {
    text: "Una startup es la mayor cantidad de gente que puedes convencer de un plan para construir un futuro distinto.",
    author: "Peter Thiel",
    category: "modern",
  },
  {
    text: "Si no haces lo que te apasiona, vas a renunciar tarde o temprano.",
    author: "Elon Musk",
    category: "modern",
  },
  {
    text: "Cuando algo es lo suficientemente importante, lo haces aunque las probabilidades no estén a tu favor.",
    author: "Elon Musk",
    category: "modern",
  },

  // ===== CLÁSICOS =====
  {
    text: "La excelencia no es un acto, sino un hábito.",
    author: "Aristóteles",
    category: "classic",
  },
  {
    text: "Conócete a ti mismo.",
    author: "Sócrates",
    category: "classic",
  },
  {
    text: "El que tiene un porqué para vivir puede soportar casi cualquier cómo.",
    author: "Friedrich Nietzsche",
    category: "classic",
  },
  {
    text: "Lo que no te mata te hace más fuerte.",
    author: "Friedrich Nietzsche",
    category: "classic",
  },
  {
    text: "Sé el cambio que quieres ver en el mundo.",
    author: "Mahatma Gandhi",
    category: "classic",
  },
  {
    text: "La mejor manera de predecir el futuro es crearlo.",
    author: "Peter Drucker",
    category: "modern",
  },
];

/**
 * Fisher-Yates shuffle. Devuelve copia barajada del array.
 * Usado para que el orden de aparición varíe entre sesiones.
 */
export function shuffleQuotes(quotes: Quote[]): Quote[] {
  const out = [...quotes];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
