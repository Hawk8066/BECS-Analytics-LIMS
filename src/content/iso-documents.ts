// ISO 17025 policy & undertaking text, extracted from the controlled documents
// in docs/ISO_Documents/*.docx (2025 versions). Update here if those change.

export interface PolicyDoc {
  title: string;
  code: string;
  version: string;
  paragraphs: string[];
}

export const IMPARTIALITY_POLICY: PolicyDoc = {
  title: "Impartiality Policy",
  code: "BECS/401/01",
  version: "2025",
  paragraphs: [
    "BECS Analytics is committed to providing fair, unbiased services based on the highest standards of technical competence and ethical conduct.",
    "Ensuring that our decisions are based solely on evidence and facts.",
    "Committed to the principles of impartiality embodied with an impartial service to her users as per ISO/IEC 17025:2017 standard for the competence of testing laboratories.",
    "Personnel, either internal or external, are provided with an impartial structural/management system which makes them independent from any undue commercial, financial or other pressures, which could affect their impartiality.",
    "BECS Analytics identifies and manages the risks to its impartiality as an ongoing activity. Those arise from her activities, or relationships of her personnel.",
    "In case any risk to impartiality is identified, BECS Analytics is committed to providing resources and other needs to demonstrate how it eliminates or minimizes the risks.",
  ],
};

export const CONFIDENTIALITY_POLICY: PolicyDoc = {
  title: "Confidentiality Policy",
  code: "BECS/402/01",
  version: "2025",
  paragraphs: [
    "BECS Analytics is committed to maintaining the confidentiality of all customers, stakeholders and partners' information, test results and other sensitive data.",
    "All the management and personnel (either permanent or associated) of BECS Analytics own a duty to safeguard the confidential information received or produced by them in the course of their professional responsibilities.",
    "Here at BECS Analytics each information is strictly confidential and is used in accordance with the law and the requirements of the standard ISO/IEC 17025:2017.",
    "In case of any breach of confidentiality, BECS Analytics owns the responsibility on behalf of its employees and associates of proportionate liability.",
    "Disclosure of confidential information is made only with the explicit consent of the owner or as required by law.",
  ],
};

export const UNDERTAKING = {
  code: "BECS/403/01",
  version: "2025",
  intro: "I, the undersigned, hereby undertake the following:",
  clauses: [
    "I understand the requirement for impartial conduct (BECS/401/01), and I commit to maintaining impartiality in all my activities while performing my duties, responsibilities, and exercising my authority.",
    "I shall not be subject to any internal and/or external pressures (financial, commercial, peer and relationship pressures).",
    "I do hereby declare that I shall maintain confidentiality (BECS/402/01) in respect of all information/activities.",
    "I shall not compromise for reasons involving my family, emotional life, political or national affinity, economic interest, or any other shared interest.",
    "I do hereby declare that, to my knowledge, I have no conflict of interest with the other staff.",
    "I do hereby confirm that, if I discover at any stage that such a conflict exists or might exist, I shall intimate it immediately to the CEO. In case such conflict is confirmed by the CEO, I agree to accept the decision taken by the management.",
    "I shall execute my responsibilities objectively.",
    "I further declare that, to the best of my knowledge, I am not in a situation that could cast doubt on my ability.",
    "I understand and abide by the consequences of breaching any information to an unauthorized person, which may not only lead to the termination of my services but also subject me to fine/imprisonment via court of law.",
  ],
};
