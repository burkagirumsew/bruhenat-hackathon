/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Centralized Event Configuration
 * 
 * Edit this configuration file to update dates, venue, registration endpoints,
 * partner information, judge profiles, prizes, and FAQs without touching HTML markup.
 */

const EVENT_CONFIG = {
  meta: {
    name: "BRUH-Enat Women's Tech Innovation Hackathon 2026",
    wordmark: "BRUH-ENAT",
    amharicName: "ብሩህ እናት",
    tagline: "Empower. Protect. Transform.",
    theme: "Her Safety, Our Innovation: Building Safer Futures.",
    edition: "2026",
    shortDescription: "A landmark two-day innovation event bringing together women technologists, AI researchers, designers, and social advocates to build survivor-centred digital solutions addressing gender-based violence in Ethiopia.",
    campaignAffiliation: "Organised as part of the global 16 Days of Activism Against Gender-Based Violence campaign (November 25 to December 10).",
    targetAudience: "Exclusively for women technologists, innovators, students, and advocates.",
  },

  scheduleMeta: {
    // Primary sprint kickoff date
    startDate: "2026-12-05",
    endDate: "2026-12-06", // or 2026-12-10 depending on Day 2 resolution
    countdownTarget: "2026-12-05T08:30:00+03:00", // East Africa Time (UTC+3)
    timezone: "EAT (UTC+3)",
    primaryVenue: {
      name: "Capstone ALX Tech Hub",
      district: "Lideta",
      city: "Addis Ababa",
      country: "Ethiopia",
      googleMapsUrl: "https://maps.app.goo.gl/XLH2PN6vTPyP2kP58",
      mapCoordinates: "8.9984, 38.7455",
    },
    // Documentation of Day 2 Confirmed Date
    day2Status: {
      statusText: "December 12, 2026",
      confirmedDate: "December 12, 2026",
      venue: "ALX Ledeta Tech Hub"
    }
  },

  // Central Challenge Statement & Statistics
  challenge: {
    headline: "Breaking the Silence: Using AI and Technology to Make Every Woman Safer.",
    statement: "How might we leverage AI and digital innovation to develop practical, safe, and inclusive solutions that help women and girls prevent gender-based violence, access trusted support, report abuse safely, and navigate protection services?",
    statsAttribution: "Ethiopian Demographic and Health Survey (EDHS) 2024–2025",
    statistics: [
      {
        value: "24%",
        metric: "Physical Violence",
        description: "Of women aged 15–49 in Ethiopia have experienced physical violence in their lifetime."
      },
      {
        value: "8%",
        metric: "Sexual Violence",
        description: "Of women aged 15–49 have experienced sexual violence, facing severe barriers to recovery."
      },
      {
        value: "58%",
        metric: "Suffered In Silence",
        description: "Of women who experienced physical or sexual violence neither sought help nor disclosed their experiences."
      }
    ]
  },

  // The 4 Innovation Tracks
  tracks: [
    {
      id: "track-01",
      number: "01",
      title: "Safe Reporting & Digital Protection",
      tagline: "Confidential, tamper-evident, and panic-resilient protection pathways.",
      challenge: "Make reporting abuse safer, confidential, and accessible while eliminating digital footprints that could endanger the survivor.",
      icon: "shield-check",
      color: "orange",
      ideas: [
        "Secure digital reporting channels with zero local history or emergency disguised triggers",
        "Encrypted incident documentation tools (audio, photo, timestamp proofs) with cloud vault protection",
        "Step-by-step reporting guidance and legal rights education in plain language",
        "Emergency panic buttons and low-bandwidth distress signal transmissions via SMS or USSD"
      ],
      deliverableExpectation: "A functional mobile, web, or USSD prototype demonstrating end-to-end data encryption and strict survivor safety mechanisms."
    },
    {
      id: "track-02",
      number: "02",
      title: "AI-Powered Information & Support",
      tagline: "Culturally fluent, localized AI assistants bridging the knowledge divide.",
      challenge: "Improve access to trusted, empathetic, and accurate information regarding rights, health, and emergency support in Ethiopian mother tongues.",
      icon: "bot",
      color: "amber",
      ideas: [
        "AI-powered triage and emotional support assistants trained on verified trauma-informed protocols",
        "Amharic, Afaan Oromoo, Tigrinya, and localized voice/text NLP conversational tools",
        "Low-literacy and audio-first interfaces for rural and peri-urban communities",
        "Context-aware guidance mapping users to immediate shelters, hotlines, and medical clinics"
      ],
      deliverableExpectation: "A localized conversational AI agent or interactive voice interface with robust guardrails against hallucinations and harmful advice."
    },
    {
      id: "track-03",
      number: "03",
      title: "Access to Support & Service Coordination",
      tagline: "Connecting survivors to verified multi-sectoral care pipelines.",
      challenge: "Help women rapidly discover and navigate trusted medical, psychosocial, legal, and shelter services across Ethiopian cities and regions.",
      icon: "network",
      color: "coral",
      ideas: [
        "Verified, crowdsourced & vetted directory of one-stop crisis centres and legal aid NGOs",
        "Privacy-first, location-based service discovery that runs offline or on low-bandwidth networks",
        "Inter-agency digital referral and case tracker that maintains absolute survivor anonymity",
        "Coordination dashboard for healthcare workers, counsellors, and emergency responders"
      ],
      deliverableExpectation: "A responsive platform or referral workflow showcasing provider verification, privacy preservation, and offline resilience."
    },
    {
      id: "track-04",
      number: "04",
      title: "Prevention, Awareness & Online Safety",
      tagline: "Combating cyberstalking, harassment, and cultivating safe digital spaces.",
      challenge: "Prevent violence before it occurs and actively address technology-facilitated gender-based violence (TFGBV) and digital harassment.",
      icon: "lock",
      color: "emerald",
      ideas: [
        "Early warning sign awareness and healthy relationship diagnostic tools for young women",
        "Cyberstalking, non-consensual image sharing, and online harassment defense toolkits",
        "Interactive gamified digital literacy curricula designed for schools and universities",
        "AI-assisted sentiment and harassment detection for Ethiopian social media spaces"
      ],
      deliverableExpectation: "An awareness or intervention application focused on preventive education, digital self-defense, or toxic online behavior detection."
    }
  ],

  // Guiding Principles & Ethical Foundation
  principles: [
    {
      number: "01",
      title: "Survivor-Centred Approach",
      summary: "Prioritise the safety, dignity, needs, and choices of survivors."
    },
    {
      number: "02",
      title: "Privacy and Confidentiality",
      summary: "Protect personal information and ensure secure handling of data."
    },
    {
      number: "03",
      title: "Do No Harm",
      summary: "Avoid creating additional risks, exposure, or harm through proposed solutions."
    },
    {
      number: "04",
      title: "Responsible AI",
      summary: "Ensure AI-powered solutions are safe, transparent, accountable, and appropriate."
    },
    {
      number: "05",
      title: "Accessibility and Inclusion",
      summary: "Design solutions that consider different languages, abilities, literacy levels, and access to technology."
    }
  ],

  // Prominent Safety Notice
  safetyNotice: "All prototype demonstrations must use fictional or anonymised synthetic information. No real survivor information or sensitive case details should be collected, uploaded, or processed during the hackathon.",

  // 5-Stage Journey & Zoom Prep Sessions
  journey: [
    { step: "01", name: "Learn", detail: "5 specialized evening masterclasses to master GBV context, survivor journeys & ethical AI." },
    { step: "02", name: "Research", detail: "Deep dive into real Ethiopian service gaps and field challenges." },
    { step: "03", name: "Apply", detail: "Register individually or as a curated team of 3–5 women changemakers." },
    { step: "04", name: "Build", detail: "Intensive 2-day sprint at Capstone ALX Tech Hub with expert mentor guidance." },
    { step: "05", name: "Pitch", detail: "Present working prototypes to an esteemed jury of tech, health & legal leaders." }
  ],

  prepSessions: [
    {
      date: "Nov 30, 2026",
      time: "7:00 PM – 8:00 PM EAT",
      topic: "Understanding GBV, warning signs, survivor journeys, and support services",
      platform: "Online via Zoom",
      objective: "Foundational domain grounding with certified gender specialists and crisis counselors."
    },
    {
      date: "Dec 1, 2026",
      time: "7:00 PM – 8:00 PM EAT",
      topic: "Mapping survivor journeys and identifying service gaps",
      platform: "Online via Zoom",
      objective: "Analyzing real friction points in current Ethiopian legal, medical, and shelter referral systems."
    },
    {
      date: "Dec 2, 2026",
      time: "7:00 PM – 8:00 PM EAT",
      topic: "Problem framing, responsible AI, research methods, and prototyping",
      platform: "Online via Zoom",
      objective: "Applying human-centred design, safe AI guardrails, prompt hygiene, and rapid prototyping tools."
    },
    {
      date: "Dec 3, 2026",
      time: "7:00 PM – 8:00 PM EAT",
      topic: "Participant matching and team formation",
      platform: "Online via Zoom",
      objective: "Connecting solo applicants across tech, design, and impact disciplines into balanced 3–5 member squads."
    },
    {
      date: "Dec 4, 2026",
      time: "7:00 PM – 8:00 PM EAT",
      topic: "Pitch preparation and communicating impact",
      platform: "Online via Zoom",
      objective: "Mastering the 5-minute hackathon demo: storytelling, technical depth, and sustainability models."
    }
  ],

  // Event Schedule Breakdown
  schedule: {
    day1: {
      title: "Day 1 — Innovation Sprint",
      dateFormatted: "Saturday, December 5, 2026",
      venue: "Capstone ALX Tech Hub, Lideta, Addis Ababa",
      mapsUrl: "https://maps.app.goo.gl/XLH2PN6vTPyP2kP58",
      agenda: [
        { time: "08:30 – 09:00", title: "Setup and Volunteer Brief", desc: "Arrival of mentors, volunteers, registration desk opening." },
        { time: "09:00 – 09:30", title: "Registration & Welcome", desc: "Check-in, badge distribution, breakfast, team station assignments." },
        { time: "09:30 – 09:40", title: "Icebreaker & Energy Booster", desc: "Community connection and cross-team introductions." },
        { time: "09:40 – 10:00", title: "Opening Remarks", desc: "Partner addresses from ALX Ethiopia, UN Women, Enat Bank, and MiNT." },
        { time: "10:00 – 10:15", title: "Problem Statement Announcement", desc: "Official sprint kickoff, challenge parameters, and submission rubric release." },
        { time: "10:15 – 13:15", title: "Hackathon Work Block 1", desc: "Architecture definition, user journey mapping, and initial sprint development." },
        { time: "13:15 – 16:15", title: "Hackathon Work Blocks & Mentorship", desc: "Deep technical build, 1-on-1 mentor sprint rounds, and prototype hardening." },
        { time: "16:15 – 16:30", title: "Final Submissions", desc: "Git repository submission, demo video, and architecture deck upload." },
        { time: "16:30 – 18:00", title: "Judges' Review & Shortlisting", desc: "Technical code review, rubric tallying, and announcement of the 6 finalist teams." }
      ]
    },
    day2: {
      title: "Day 2 — Final Pitch & Awards",
      dateFormatted: "Saturday, December 12, 2026",
      venue: "ALX Ledeta Tech Hub",
      mapsUrl: "https://maps.app.goo.gl/XLH2PN6vTPyP2kP58",
      isTentative: false,
      agenda: [
        { time: "09:00 – 09:30", title: "Registration & Welcome", desc: "Guest arrival, showcase viewing, and morning tea." },
        { time: "09:30 – 09:40", title: "Opening & Day 1 Recap", desc: "Sprint highlight reel and introduction of the 6 finalist teams." },
        { time: "09:40 – 10:20", title: "Panel Discussion", desc: "Executive panel: 'Technology, Safety & Women's Economic Sovereignty in Ethiopia'." },
        { time: "10:20 – 10:30", title: "Transition & Stage Prep", desc: "Technical check for live demonstrations." },
        { time: "10:30 – 12:30", title: "Finalist Presentations", desc: "The top 6 teams pitch live (10 min pitch + 5 min Q&A per team) to the jury." },
        { time: "12:30 – 13:00", title: "Judges' Deliberation", desc: "Scoring consolidation across Safety (30%), Impact (25%), Feasibility (25%), and Innovation (20%)." },
        { time: "13:00 – 14:00", title: "Lunch & Networking", desc: "Exhibition walkthrough and ecosystem networking between participants and partners." },
        { time: "14:00 – 14:30", title: "Awards Ceremony", desc: "Announcement of 1st, 2nd, and 3rd place winners and partner special recognitions." },
        { time: "14:30 – 14:45", title: "Closing Remarks", desc: "Closing reflections by organizing executive leaders and call to incubation." },
        { time: "14:45 – 15:30", title: "Media & Content Capture", desc: "Official press photos, team interviews, and post-event media engagement." }
      ]
    }
  },

  // Judging Criteria
  judgingCriteria: [
    {
      weight: "30%",
      percent: 30,
      title: "Safety, Privacy & Do No Harm",
      color: "#EA580C", // orange
      description: "How rigorously does the solution protect the survivor? Judges assess zero-trace mechanisms, end-to-end data encryption, emergency disguise modes, consent frameworks, and risk mitigation against perpetrator retaliations."
    },
    {
      weight: "25%",
      percent: 25,
      title: "Impact & Relevance",
      color: "#F97316", // bright orange
      description: "Does the solution directly address real Ethiopian GBV statistics and survivor realities? Does it solve an urgent need in reporting, psycho-social care, or legal coordination with tangible community outcomes?"
    },
    {
      weight: "25%",
      percent: 25,
      title: "Feasibility & Inclusion",
      color: "#F59E0B", // amber
      description: "Can this prototype realistically scale across Ethiopian infrastructure? Evaluates local language accessibility (Amharic, Afaan Oromoo, Tigrinya), low-bandwidth or offline readiness, USSD capability, and user simplicity."
    },
    {
      weight: "20%",
      percent: 20,
      title: "Innovation & Technical Execution",
      color: "#10B981", // emerald
      description: "Originality and quality of the technical implementation. How intelligently are AI, modern web/mobile technologies, or cryptographic vaults utilized? Working quality of the prototype demonstrated on stage."
    }
  ],

  // Prizes & Growth Pathways (Updated per Specification)
  prizes: {
    statusNote: "Prize allocation subject to final partner ratification before launch.",
    tiers: [
      {
        place: "1st Place",
        title: "Grand Innovation Champion",
        amountETB: "250,000 ETB",
        featured: true,
        perks: [
          "Direct entry into MiNT Ventures incubation track",
          "Access to initial financing opportunities through Enat Bank.",
          "Executive mentorship with UN Women & Enat Bank leadership",
          "Pilot deployment consultation with government stakeholders"
        ]
      },
      {
        place: "2nd Place",
        title: "2nd Place",
        amountETB: "150,000 ETB",
        featured: false,
        perks: []
      },
      {
        place: "3rd Place",
        title: "3rd Place",
        amountETB: "100,000 ETB",
        featured: false,
        perks: []
      }
    ],
    additionalOpportunities: [
      { title: "Specialized Mentorship", desc: "Direct pairing with seasoned software architects, GBV caseworkers, and legal advocates." },
      { title: "Incubation Pathways", desc: "Structured acceleration to transition hackathon prototypes into sustainable social enterprises." },
      { title: "Technical Guidance", desc: "Security auditing, AI model fine-tuning, and cloud architecture advisory." },
      { title: "Pilot Opportunities", desc: "Testing prototypes within verified civil society networks and one-stop crisis centres." },
      { title: "Ecosystem Exposure", desc: "High-visibility stage presence in front of investors, NGOs, and ministerial leadership." }
    ]
  },

  // Organizers & Partners
  partners: [
    {
      id: "alx-ethiopia",
      name: "ALX Ethiopia",
      category: "Lead Ecosystem & Venue Partner",
      role: "Empowering Africa's next generation of leaders and tech changemakers; providing modern sprint infrastructure at Capstone ALX Tech Hub.",
      website: "https://www.alxethiopia.com",
      badgeText: "Host & Tech Hub"
    },
    {
      id: "un-women",
      name: "UN Women",
      category: "United Nations Entity for Gender Equality",
      role: "Global champion for women and girls; guiding survivor-centred principles, GBV domain expertise, and human rights oversight.",
      website: "https://www.unwomen.org",
      badgeText: "Domain & Impact Partner"
    },
    {
      id: "enat-bank",
      name: "Enat Bank",
      category: "Pioneering Financial Institution",
      role: "Ethiopia's premier bank founded by visionary women leaders; driving financial inclusion, economic empowerment, and prize sponsorship.",
      website: "https://www.enatbanksc.com",
      badgeText: "Sponsor & Empowerment Partner"
    },
    {
      id: "mint",
      name: "MiNT",
      fullName: "Ministry of Innovation and Technology",
      category: "Federal Democratic Republic of Ethiopia",
      role: "National policy steward advancing digital transformation, AI ethics, and fostering inclusive tech innovation across Ethiopia.",
      website: "https://mint.gov.et",
      badgeText: "Government & Policy Partner"
    },
    {
      id: "mols",
      name: "Ministry of Labour & Skills",
      fullName: "Ministry of Labour and Skills",
      category: "Federal Democratic Republic of Ethiopia",
      role: "National champion driving workforce development, job creation, technical training, and institutional capacity-building across Ethiopia.",
      website: "https://mols.gov.et",
      badgeText: "Skills & Capacity Partner"
    }
  ],

  // Judges & Mentors Panel (To Be Announced)
  judges: [
    {
      name: "To Be Announced",
      status: "To Be Announced",
      isConfirmed: false,
      avatarInitials: "TBA"
    },
    {
      name: "To Be Announced",
      status: "To Be Announced",
      isConfirmed: false,
      avatarInitials: "TBA"
    },
    {
      name: "To Be Announced",
      status: "To Be Announced",
      isConfirmed: false,
      avatarInitials: "TBA"
    },
    {
      name: "To Be Announced",
      status: "To Be Announced",
      isConfirmed: false,
      avatarInitials: "TBA"
    }
  ],

  // Who Can Participate
  profiles: [
    { title: "Software Developers", desc: "Frontend, backend, full-stack, mobile, and USSD/SMS engineering enthusiasts." },
    { title: "AI & ML Enthusiasts", desc: "Prompt engineers, NLP practitioners, and responsible machine learning innovators." },
    { title: "Data Analysts & Researchers", desc: "Data scientists, public health analysts, and qualitative researchers." },
    { title: "UI/UX & Graphic Designers", desc: "Interaction designers, accessibility advocates, and visual storytellers." },
    { title: "Business & Entrepreneurship", desc: "Product managers, startup founders, and operational strategists." },
    { title: "Gender & Social Impact Advocates", desc: "GBV caseworkers, legal practitioners, human rights defenders, and counselors." },
    { title: "Communications Specialists", desc: "Community organizers, campaign managers, and public outreach leaders." },
    { title: "University Students & Graduates", desc: "Passionate young women eager to apply classroom knowledge to real societal change." }
  ],

  // Team Formation Rules
  teamRules: {
    eligibilityNotice: "Exclusively open to women participants residing in Ethiopia or of Ethiopian origin.",
    minMembers: 3,
    maxMembers: 5,
    individualMatching: true,
    teamLeaderRequired: true,
    skillDiversityBonus: true,
    finalistCount: 6,
    summary: "Register as a formed team of 3–5 women or apply individually to be matched with complementary peers during our December 3 team-matching session."
  },

  // Frequently Asked Questions
  faqs: [
    {
      id: "faq-01",
      category: "General",
      question: "What is the BRUH-Enat Women's Tech Innovation Hackathon?",
      answer: "BRUH-Enat ('Bright Mother' / ብሩህ እናት) is a landmark two-day hackathon hosted in Addis Ababa. It brings together women across technology, AI, design, research, and social advocacy to create practical digital tools addressing gender-based violence (GBV) in Ethiopia. It is co-organized by ALX Ethiopia, UN Women, Enat Bank, and the Ministry of Innovation and Technology (MiNT)."
    },
    {
      id: "faq-02",
      category: "Eligibility",
      question: "Who can participate in the hackathon?",
      answer: "The hackathon is exclusively for women. We welcome software engineers, AI researchers, designers, university students, gender advocates, legal professionals, and business strategists. Multi-disciplinary perspectives are critical to creating solutions that are safe, ethical, and practical."
    },
    {
      id: "faq-03",
      category: "Eligibility",
      question: "Do I need advanced coding or technical experience?",
      answer: "No, advanced technical experience is NOT required! Impactful survivor-centred solutions require problem framers, user experience researchers, domain experts in gender equality, and project pitch leaders just as much as coders. All registered participants also receive 5 evening Zoom training sessions prior to the event."
    },
    {
      id: "faq-04",
      category: "Teams",
      question: "Can I register individually, or must I already have a team?",
      answer: "You can apply through either pathway! If you have an existing team of 3–5 women, register under 'Existing Team Application' with a designated team leader. If you apply as an individual, you will be invited to our online matching session on December 3, 2026, where we will help pair you with peers based on complementary skills."
    },
    {
      id: "faq-05",
      category: "Teams",
      question: "How many people can be on a team?",
      answer: "Each team must consist of 3 to 5 women. To ensure high solution quality, we strongly encourage teams to combine both technical skills (developers, AI/data specialists) and non-technical expertise (designers, social advocates, business strategists)."
    },
    {
      id: "faq-06",
      category: "Tracks",
      question: "What are the innovation tracks?",
      answer: "There are four core innovation tracks: 1) Safe Reporting & Digital Protection, 2) AI-Powered Information & Support, 3) Access to Support & Service Coordination, and 4) Prevention, Awareness & Online Safety. Each track targets a distinct challenge area in the fight against gender-based violence."
    },
    {
      id: "faq-07",
      category: "Building",
      question: "What will participants build during the hackathon?",
      answer: "Teams will build functional digital prototypes such as web applications, mobile tools, USSD/SMS services, localized AI conversational interfaces, or referral dashboards. Strict Rule: All demonstrations must use fictional or anonymized synthetic data. Under no circumstances should real survivor details or sensitive case files be collected or shared."
    },
    {
      id: "faq-08",
      category: "Judging",
      question: "How will teams be evaluated by the judges?",
      answer: "Submissions are evaluated on a 100-point rubric across four key criteria: Safety, Privacy & Do No Harm (30%), Impact & Relevance (25%), Feasibility & Inclusion (25%), and Innovation & Technical Execution (20%). The highest weighting is placed on survivor protection and safety."
    },
    {
      id: "faq-09",
      category: "Prizes",
      question: "What are the prizes and post-hackathon opportunities?",
      answer: "The allocated prize pool includes 250,000 ETB for 1st Place, 150,000 ETB for 2nd Place, and 100,000 ETB for 3rd Place (status pending final partner ratification). Beyond cash rewards, winners and top finalists gain access to incubation pathways through MiNT Ventures, initial financing opportunities through Enat Bank, and executive mentorship."
    },
    {
      id: "faq-10",
      category: "Logistics",
      question: "Where and when will the event take place?",
      answer: "Day 1 (Innovation Sprint) takes place in person on Saturday, December 5, 2026 at the Capstone ALX Tech Hub in Lideta, Addis Ababa. Day 2 (Final Pitch & Awards) takes place on Saturday, December 12, 2026 at the ALX Ledeta Tech Hub. Prior to the sprint, 5 online Zoom prep sessions occur nightly from November 30 to December 4, 2026 (7:00 PM – 8:00 PM EAT)."
    },
    {
      id: "faq-11",
      category: "Aftermath",
      question: "What happens after the hackathon concludes?",
      answer: "The top finalist teams receive post-event incubation guidance through MiNT Ventures and initial financing pathways through Enat Bank to help refine prototypes into viable, field-tested tools."
    }
  ],

  // Emergency Hotlines & GBV Resources in Ethiopia (Safety & Support Notice)
  emergencyResources: {
    notice: "If you or someone you know is in immediate danger or needs confidential support in Ethiopia:",
    hotlines: [
      { name: "National GBV Helpline", number: "7711", free: "Toll-Free in Ethiopia" },
      { name: "Ethiopian Women Lawyers Association (EWLA)", number: "+251 11 550 8394", free: "Legal Aid & Counseling" },
      { name: "Police Emergency", number: "991", free: "National Emergency" }
    ]
  },

  // Official Social Media Channels (Ready for URLs)
  socialMedia: {
    telegram: "https://t.me/+hzjFVoNO4oowNzI0",
    instagram: "", // Ready for official handle
    facebook: "",  // Ready for official handle
    linkedin: "",  // Ready for official handle
    twitter: ""    // Ready for official handle
  },

  // Official Contact Information
  contact: {
    email: "ethiopia@alxafrica.com",
    telegram: "https://t.me/+hzjFVoNO4oowNzI0"
  },

  // Developer & Organizer Integration Settings
  integration: {
    // Native DirectAdmin / Local API endpoint (empty string uses same-origin relative path /api)
    apiUrl: (typeof window !== "undefined" && window.BIRUH_ENAT_API_URL) || "",
    // Official backend API endpoint for registrations
    submissionEndpoint: "/api/register",
    localStorageKey: "bruh_enat_hackathon_app_v1",
    enableSafetyQuickExit: true,
    quickExitUrl: "https://www.google.com"
  }
};

// Freeze config to prevent accidental runtime modifications
if (typeof Object.freeze === "function") {
  Object.freeze(EVENT_CONFIG);
}

// Export for ES modules and standard browser globals
if (typeof module !== "undefined" && module.exports) {
  module.exports = EVENT_CONFIG;
}
