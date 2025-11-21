const gradeLevels = [
    { id: '5', label: 'Klasse 5' },
    { id: '6', label: 'Klasse 6' },
    { id: '7', label: 'Klasse 7' },
    { id: '8', label: 'Klasse 8' },
    { id: '9', label: 'Klasse 9' },
    { id: '10', label: 'Klasse 10' },
    { id: '11', label: 'Klasse 11 (E-Phase)' },
    { id: '12', label: 'Klasse 12 (Q1)' },
    { id: '13', label: 'Klasse 13 (Q2)' }
];

const availableStates = [
    { id: 'BW', label: 'Baden-Württemberg' },
    { id: 'BY', label: 'Bayern' },
    { id: 'NW', label: 'Nordrhein-Westfalen' },
    { id: 'RP', label: 'Rheinland-Pfalz' },
    { id: 'BE', label: 'Berlin' },
    { id: 'HH', label: 'Hamburg' }
];

const curriculumData = {
    BW: {
        label: 'Baden-Württemberg',
        source: 'https://km-bw.de/Unterricht',
        grades: {
            '5': {
                lastUpdated: '2024-09-15',
                summary: 'Orientierungsstufe der Sekundarstufe I',
                subjects: [
                    {
                        id: 'math',
                        name: 'Mathematik',
                        focus: ['Brüche & Dezimalzahlen', 'Geometrie im Raum'],
                        topics: [
                            {
                                title: 'Brüche verstehen und darstellen',
                                description: 'Verständnis für Bruchteile, Kürzen und Erweitern mithilfe von Alltagssituationen und visuellen Modellen.',
                                competencies: ['Darstellen von Bruchteilen', 'Kürzen & Erweitern', 'Vergleichen von Bruchzahlen'],
                                resources: [
                                    { type: 'material', label: 'Serlo: Brüche vergleichen', url: 'https://de.serlo.org/mathe/43584/bruchzahlen-vergleichen' },
                                    { type: 'video', label: 'Lehrerschmidt: Brüche erklärt', url: 'https://www.youtube.com/watch?v=Dh8DsICoZbU' },
                                    { type: 'tutorial', label: 'OER Commons Arbeitsblatt', url: 'https://www.oercommons.org/courseware/lesson/104550' }
                                ]
                            },
                            {
                                title: 'Volumen und Oberfläche von Körpern',
                                description: 'Berechnung von Quadern, Prismen und Pyramiden inklusive Einheitenumrechnung und Sachaufgaben.',
                                competencies: ['Formelumstellung', 'Einheiten sicher anwenden', 'Sachaufgaben strukturieren'],
                                resources: [
                                    { type: 'material', label: 'Serlo: Geometrie Körper', url: 'https://de.serlo.org/mathe/geometrie/geometrische-koerper' },
                                    { type: 'video', label: 'SimpleMath: Volumen Quader', url: 'https://www.youtube.com/watch?v=iHqS_N1-9x0' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'german',
                        name: 'Deutsch',
                        focus: ['Lesestrategien', 'Grammatik wiederholen'],
                        topics: [
                            {
                                title: 'Argumentieren im Klassenrat',
                                description: 'Aufbau einfacher Argumentationen mit Begründung und Beispiel, sichere Nutzung von Konnektoren.',
                                competencies: ['Argumentationsaufbau', 'Sprachliche Mittel anwenden'],
                                resources: [
                                    { type: 'tutorial', label: 'Planet Schule: Argumentieren', url: 'https://www.planet-schule.de/sf/php/mmewin.php?sendung=7798' },
                                    { type: 'material', label: 'Worksheet: Argumente sortieren', url: 'https://www.lehrer-online.de/meldung/argumentieren/' }
                                ]
                            },
                            {
                                title: 'Zeichensetzung bei direkter Rede',
                                description: 'Regeln zur direkten Rede in Dialogen anwenden, korrekte Zeichensetzung trainieren.',
                                competencies: ['Zeichensetzung', 'Dialoggestaltung'],
                                resources: [
                                    { type: 'tutorial', label: 'Serlo: Direkte Rede', url: 'https://de.serlo.org/deutsch/grammatik/zeichensetzung/direkte-rede' },
                                    { type: 'video', label: 'Deutschstunde: Direkte Rede', url: 'https://www.youtube.com/watch?v=jGTP0TOZV48' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'science',
                        name: 'Naturphänomene',
                        focus: ['Energieformen', 'Wasser als Lebensraum'],
                        topics: [
                            {
                                title: 'Energieumwandlungen im Alltag',
                                description: 'Nachhaltige Energieformen erkennen, Umwandlungen in einfachen Experimenten untersuchen.',
                                competencies: ['Versuchsdurchführung', 'Diagramme lesen', 'Fachbegriffe anwenden'],
                                resources: [
                                    { type: 'material', label: 'Haus der kleinen Forscher: Energie', url: 'https://www.haus-der-kleinen-forscher.de' },
                                    { type: 'video', label: 'Checker Tobi: Energie', url: 'https://www.ardmediathek.de/video/checker-tobi/energie' }
                                ]
                            },
                            {
                                title: 'Ökosystem Bach',
                                description: 'Lebensräume beschreiben, Nahrungsketten zeichnen und Gewässer schützen.',
                                competencies: ['Beobachten & Dokumentieren', 'Fachbegriffe nutzen'],
                                resources: [
                                    { type: 'material', label: 'NABU: Lebensraum Bach', url: 'https://www.nabu.de/tiere-und-pflanzen/lebensraeume/baeche-und-fluesse/index.html' }
                                ]
                            }
                        ]
                    }
                ]
            },
            '10': {
                lastUpdated: '2024-10-01',
                summary: 'Vorbereitung auf die Abschlussprüfung Werkrealschule/Realschule',
                subjects: [
                    {
                        id: 'math',
                        name: 'Mathematik',
                        focus: ['Lineare Funktionen', 'Daten & Zufall'],
                        topics: [
                            {
                                title: 'Lineare Funktionen im Kontext',
                                description: 'Steigungen interpretieren, Funktionsgleichungen aus Alltagssituationen ableiten, Schnittpunkte bestimmen.',
                                competencies: ['Funktionsanalyse', 'Sachaufgaben modellieren'],
                                resources: [
                                    { type: 'material', label: 'Serlo: Lineare Funktionen', url: 'https://de.serlo.org/mathe/lineare-funktionen' },
                                    { type: 'video', label: 'Die Merkhilfe: Lineare Funktionen', url: 'https://www.youtube.com/watch?v=6xgGkzAEmlY' }
                                ]
                            },
                            {
                                title: 'Boxplots & Lageparameter',
                                description: 'Datensätze interpretieren, Median & Quartile bestimmen, Ausreißer erkennen.',
                                competencies: ['Daten interpretieren', 'Werkzeuge anwenden'],
                                resources: [
                                    { type: 'tutorial', label: 'Serlo: Boxplot', url: 'https://de.serlo.org/mathe/statistik/boxplot' },
                                    { type: 'material', label: 'GeoGebra Classroom', url: 'https://www.geogebra.org/m/zfwtvfgv' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'english',
                        name: 'Englisch',
                        focus: ['Argumentative Writing', 'Globalisation'],
                        topics: [
                            {
                                title: 'Opinion Essay schreiben',
                                description: 'These formulieren, Pro/Contra strukturieren, Linking Words sicher anwenden.',
                                competencies: ['Textstruktur', 'Argumentationssprache'],
                                resources: [
                                    { type: 'tutorial', label: 'British Council: Opinion Essays', url: 'https://learnenglishteens.britishcouncil.org/skills/writing' },
                                    { type: 'material', label: 'Worksheet: Useful Linking Words', url: 'https://www.englishclub.com/ref/Useful_Phrases/Linking_Words/' }
                                ]
                            },
                            {
                                title: 'Global Challenges',
                                description: 'Klimawandel, Migration und Digitalisierung diskutieren, Debatten auf Englisch führen.',
                                competencies: ['Diskutieren', 'Fachvokabular einsetzen'],
                                resources: [
                                    { type: 'video', label: 'BBC Learning: Climate Change', url: 'https://www.bbc.co.uk/learningenglish' },
                                    { type: 'tutorial', label: 'UN Kakuma Project', url: 'https://share.america.gov/lesson-plans/' }
                                ]
                            }
                        ]
                    }
                ]
            }
        }
    },
    BY: {
        label: 'Bayern',
        source: 'https://www.km.bayern.de/unterricht/lehrplaene.html',
        grades: {
            '8': {
                lastUpdated: '2024-09-20',
                summary: 'Mittlere-Reife-Zug: Kompetenzorientierte Themen',
                subjects: [
                    {
                        id: 'math',
                        name: 'Mathematik',
                        focus: ['Quadratische Funktionen', 'Stochastik'],
                        topics: [
                            {
                                title: 'Scheitelpunktsform & Normalform',
                                description: 'Parabeln analysieren, Nullstellen berechnen, Modellierungen mit GeoGebra.',
                                competencies: ['Funktionsumformung', 'Technikeinsatz'],
                                resources: [
                                    { type: 'material', label: 'Mathe by Daniel Jung', url: 'https://www.youtube.com/watch?v=nccRwwLQWKM' },
                                    { type: 'tutorial', label: 'Serlo: Quadratische Funktionen', url: 'https://de.serlo.org/mathe/quadratische-funktionen' }
                                ]
                            },
                            {
                                title: 'Baumdiagramme & Pfadregeln',
                                description: 'Mehrstufige Zufallsexperimente darstellen, Pfadregeln sicher anwenden.',
                                competencies: ['Wahrscheinlichkeiten berechnen', 'Probleme modellieren'],
                                resources: [
                                    { type: 'material', label: 'ISB Bayern Aufgabenpool', url: 'https://www.isb.bayern.de/mittelschule/faecher/mathematik/' },
                                    { type: 'video', label: 'Die Merkhilfe: Baumdiagramm', url: 'https://www.youtube.com/watch?v=5oQAIwy0uQo' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'history',
                        name: 'Geschichte/Sozialkunde',
                        focus: ['Weimarer Republik', 'Demokratiesicherung'],
                        topics: [
                            {
                                title: 'Krisen der Weimarer Republik',
                                description: 'Verfassung, Krisenjahre 1923, Rolle Jugendlicher in politischen Umbrüchen.',
                                competencies: ['Quellenarbeit', 'Mehrperspektivität'],
                                resources: [
                                    { type: 'material', label: 'Planet Schule: Weimar', url: 'https://www.planet-schule.de/sf/html/module/weimar/' },
                                    { type: 'video', label: 'MrWissen2Go Geschichte', url: 'https://www.youtube.com/watch?v=f2IsonMSKZ4' }
                                ]
                            },
                            {
                                title: 'Grundgesetz & Jugendparlamente',
                                description: 'Bedeutung des GG, Partizipation über Jugendräte, lokale Fallstudien.',
                                competencies: ['Politische Urteilsbildung', 'Argumentieren'],
                                resources: [
                                    { type: 'tutorial', label: 'bpb Jugend und Politik', url: 'https://www.bpb.de/lernen/grafstat/' }
                                ]
                            }
                        ]
                    }
                ]
            }
        }
    },
    NW: {
        label: 'Nordrhein-Westfalen',
        source: 'https://www.schulministerium.nrw/lehrplaene',
        grades: {
            '7': {
                lastUpdated: '2024-08-30',
                summary: 'G8/G9 Sek I – Kompetenzorientierte Module',
                subjects: [
                    {
                        id: 'math',
                        name: 'Mathematik',
                        focus: ['Proportionalität', 'Dateninterpretation'],
                        topics: [
                            {
                                title: 'Direkte & indirekte Proportionalität',
                                description: 'Tabellen, Graphen und Gleichungen vergleichen, Sachaufgaben lösen.',
                                competencies: ['Modellieren', 'Darstellungswechsel'],
                                resources: [
                                    { type: 'tutorial', label: 'Serlo: Proportionalität', url: 'https://de.serlo.org/mathe/1671/proportionale-zusammenhaenge' },
                                    { type: 'video', label: 'Mathe Total: Dreisatz', url: 'https://www.youtube.com/watch?v=iAvgGA6Ipyc' }
                                ]
                            },
                            {
                                title: 'Statistische Kennzahlen',
                                description: 'Mittelwert, Median, Modus bestimmen, Diagramme deuten.',
                                competencies: ['Daten beschreiben', 'Mathematisches Argumentieren'],
                                resources: [
                                    { type: 'material', label: 'Serlo: Lageparameter', url: 'https://de.serlo.org/mathe/statistik/lage-und-streuungsparameter' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'biology',
                        name: 'Biologie',
                        focus: ['Zellen & Krankheiten', 'Nachhaltiges Handeln'],
                        topics: [
                            {
                                title: 'Immunsystem & Impfungen',
                                description: 'Aufbau des Immunsystems, Impfstrategien vergleichen, Fake News erkennen.',
                                competencies: ['Bewerten', 'Fachwissen anwenden'],
                                resources: [
                                    { type: 'video', label: 'MaiLab: Impfungen', url: 'https://www.youtube.com/watch?v=LyC6UQ0YfZ8' },
                                    { type: 'material', label: 'DGUV Unterrichtsmaterial', url: 'https://www.dguv-lug.de' }
                                ]
                            },
                            {
                                title: 'Upcycling-Projekt',
                                description: 'Materialkreisläufe verstehen, Projekt planen und präsentieren.',
                                competencies: ['Planen & Durchführen', 'Teamarbeit'],
                                resources: [
                                    { type: 'tutorial', label: 'EduYou: Upcycling Ideen', url: 'https://eduyou.de/upcycling-schule' }
                                ]
                            }
                        ]
                    }
                ]
            }
        }
    },
    BE: {
        label: 'Berlin',
        source: 'https://www.berlin.de/sen/bildung/schule/unterricht/lehrplaene/',
        grades: {
            '11': {
                lastUpdated: '2024-10-10',
                summary: 'Gymnasiale Oberstufe – Einführungsphase',
                subjects: [
                    {
                        id: 'german',
                        name: 'Deutsch (Leistungskurs)',
                        focus: ['Literatur der Moderne', 'Rhetorik'],
                        topics: [
                            {
                                title: 'Expressionismus & Großstadtliteratur',
                                description: 'Analyse lyrischer Texte, Vergleich mit grafischen Medien.',
                                competencies: ['Textanalyse', 'Vergleichende Interpretation'],
                                resources: [
                                    { type: 'material', label: 'ZUM-Unterrichten: Expressionismus', url: 'https://unterrichten.zum.de/wiki/Expressionismus' },
                                    { type: 'video', label: 'SWR Doku: Berlin 1920', url: 'https://www.ardmediathek.de' }
                                ]
                            },
                            {
                                title: 'Politische Rede schreiben',
                                description: 'Redeabschnitte planen, Stilmittel bewusst einsetzen, Auftritt trainieren.',
                                competencies: ['Rhetorik', 'Performance'],
                                resources: [
                                    { type: 'tutorial', label: 'Debattierclub Berlin', url: 'https://www.berliner-debating-union.de/materialien' }
                                ]
                            }
                        ]
                    }
                ]
            }
        }
    },
    HH: {
        label: 'Hamburg',
        source: 'https://www.hamburg.de/bsb/lehrplaene/',
        grades: {
            '12': {
                lastUpdated: '2024-09-05',
                summary: 'Profiloberstufe – Medien & Gesellschaft',
                subjects: [
                    {
                        id: 'social',
                        name: 'Gesellschaftswissenschaften',
                        focus: ['Digitale Öffentlichkeit', 'Ethik der KI'],
                        topics: [
                            {
                                title: 'KI im Alltag kritisch reflektieren',
                                description: 'Chancen & Risiken von Generative AI analysieren, Fallbeispiele diskutieren.',
                                competencies: ['Bewerten', 'Reflektieren', 'Präsentieren'],
                                resources: [
                                    { type: 'material', label: 'TIB-Lernlabor KI', url: 'https://tib.eu/ki-lab' },
                                    { type: 'video', label: 'Deutschlandfunk Nova: KI erklärt', url: 'https://www.deutschlandfunknova.de/podcasts' }
                                ]
                            },
                            {
                                title: 'Campaigning in sozialen Medien',
                                description: 'Eigene Awareness-Kampagne planen, Storytelling-Methoden anwenden.',
                                competencies: ['Projektplanung', 'Analyse von Medienformaten'],
                                resources: [
                                    { type: 'tutorial', label: 'Hamburg macht Schule: Medienpass', url: 'https://li.hamburg.de/medienpass/' }
                                ]
                            }
                        ]
                    }
                ]
            }
        }
    },
    RP: {
        label: 'Rheinland-Pfalz',
        source: 'https://schulcampus-rlp.de',
        grades: {
            '8': {
                lastUpdated: '2024-09-25',
                summary: 'Gymnasium Sekundarstufe I – vollständiger Fächerkanon',
                subjects: [
                    {
                        id: 'math',
                        name: 'Mathematik',
                        focus: ['Lineare Funktionen festigen', 'Quadratische Gleichungen', 'Statistik-Projekte'],
                        topics: [
                            {
                                title: 'Lineare Funktionen im Koordinatensystem',
                                description: 'Steigung und Achsenabschnitte deuten, Funktionsgleichungen aus Tabellen und Alltagssituationen ableiten.',
                                competencies: ['Funktionsbegriff anwenden', 'Sachaufgaben modellieren'],
                                activeMonths: [9, 10, 11],
                                resources: [
                                    { type: 'material', label: 'Serlo: Lineare Funktionen', url: 'https://de.serlo.org/mathe/lineare-funktionen' },
                                    { type: 'video', label: 'Daniel Jung: Steigung', url: 'https://www.youtube.com/watch?v=w9wKxO6-hlI' }
                                ]
                            },
                            {
                                title: 'Quadratische Gleichungen & Scheitelpunktform',
                                description: 'Parabeln skizzieren, Nullstellen berechnen, Modellierungen mit GeoGebra durchführen.',
                                competencies: ['Funktionsanalyse', 'Digitales Werkzeug nutzen'],
                                activeMonths: [11, 12, 1],
                                resources: [
                                    { type: 'tutorial', label: 'GeoGebra Classroom Parabeln', url: 'https://www.geogebra.org/m/qk5mdmgb' },
                                    { type: 'video', label: 'Mathe by Daniel Jung: PQ-Formel', url: 'https://www.youtube.com/watch?v=pnJ3Adxpv8I' }
                                ]
                            },
                            {
                                title: 'Datenerhebung & Lageparameter',
                                description: 'Eigene Umfragen planen, Mittelwert/Median/Quartile bestimmen und Ergebnisse präsentieren.',
                                competencies: ['Daten interpretieren', 'Präsentieren'],
                                activeMonths: [2, 3, 4],
                                resources: [
                                    { type: 'material', label: 'Statistik-Tool: ZUM-Unterrichten', url: 'https://unterrichten.zum.de/wiki/Statistik_in_der_Schule' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'german',
                        name: 'Deutsch',
                        focus: ['Epische Texte analysieren', 'Sachtexte schreiben', 'Sprachbewusstsein stärken'],
                        topics: [
                            {
                                title: 'Interpretation von Jugendromanen',
                                description: 'Erzählperspektiven untersuchen, Figurenkonstellationen herausarbeiten, kreative Transferaufgaben erledigen.',
                                competencies: ['Textanalyse', 'Deutungshypothesen formulieren'],
                                activeMonths: [9, 10, 11],
                                resources: [
                                    { type: 'material', label: 'ZUM: Jugendroman-Pakete', url: 'https://unterrichten.zum.de/wiki/Jugendromane' }
                                ]
                            },
                            {
                                title: 'Sachtext & Kommentar verfassen',
                                description: 'Aufbau von informierenden und argumentativen Texten trainieren, sprachliche Mittel reflektieren.',
                                competencies: ['Schreibkompetenz', 'Sprachliche Mittel bewusst einsetzen'],
                                activeMonths: [1, 2, 3],
                                resources: [
                                    { type: 'tutorial', label: 'Planet Schule: Schreibwerkstatt', url: 'https://www.planet-schule.de/sf/html/module/schreibwerkstatt/' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'english',
                        name: 'Englisch',
                        focus: ['Global citizenship', 'Writing Skills', 'Listening & Speaking'],
                        topics: [
                            {
                                title: 'Global Challenges & Teen Life',
                                description: 'Themen wie Klimawandel, Social Media und Diversity diskutieren und reflektieren.',
                                competencies: ['Debattieren', 'Vocabulary in context'],
                                activeMonths: [9, 10, 11],
                                resources: [
                                    { type: 'material', label: 'BBC Teach: Global Citizenship', url: 'https://www.bbc.co.uk/teach/resources/secondary' }
                                ]
                            },
                            {
                                title: 'Opinion/Comment Writing',
                                description: 'These formulieren, argumentative Struktur mit Linking Words sicher anwenden.',
                                competencies: ['Writing Coherence', 'Argumentative language'],
                                activeMonths: [12, 1, 2],
                                resources: [
                                    { type: 'tutorial', label: 'British Council: Writing practice', url: 'https://learnenglishteens.britishcouncil.org/skills/writing' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'physics',
                        name: 'Physik',
                        focus: ['Mechanik vertiefen', 'Elektrische Stromkreise', 'Energieumwandlungen'],
                        topics: [
                            {
                                title: 'Bewegungsgesetze im Experiment',
                                description: 'Geschwindigkeit, Beschleunigung und Kräfte mit Messwerterfassung untersuchen.',
                                competencies: ['Experimentieren', 'Diagramme interpretieren'],
                                activeMonths: [9, 10],
                                resources: [
                                    { type: 'video', label: 'LeifiPhysik: Bewegungen', url: 'https://www.leifiphysik.de/mechanik/gleichfoermige-bewegung' }
                                ]
                            },
                            {
                                title: 'Elektrische Energie & Ohmsches Gesetz',
                                description: 'Stromkreise simulieren, Widerstände berechnen und Sicherheitsaspekte diskutieren.',
                                competencies: ['Messreihen planen', 'Technik reflektieren'],
                                activeMonths: [1, 2, 3],
                                resources: [
                                    { type: 'tutorial', label: 'PhET Simulation: Stromkreise', url: 'https://phet.colorado.edu/de/simulation/circuit-construction-kit-dc' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'chemistry',
                        name: 'Chemie',
                        focus: ['Stoff-Ebene & Teilchenmodell', 'Säuren/Basen', 'Nachhaltige Chemie'],
                        topics: [
                            {
                                title: 'Chemische Reaktionen beobachten',
                                description: 'Indikatoren, Energieumsätze und Gesetzmäßigkeiten analysieren.',
                                competencies: ['Versuchsdurchführung', 'Fachsprache nutzen'],
                                activeMonths: [9, 10, 11],
                                resources: [
                                    { type: 'material', label: 'Chemie im Kontext: Reaktionen', url: 'https://www.chemikum.info/unterricht' }
                                ]
                            },
                            {
                                title: 'Säuren, Basen & pH-Wert',
                                description: 'Alltagsbeispiele recherchieren, Neutralisationsreaktionen durchführen und dokumentieren.',
                                competencies: ['Bewerten', 'Experiment protokollieren'],
                                activeMonths: [2, 3, 4],
                                resources: [
                                    { type: 'video', label: 'SimpleChemConcepts: Säuren/Basen', url: 'https://www.youtube.com/watch?v=mAEG0KDWlMo' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'biology',
                        name: 'Biologie',
                        focus: ['Genetik Grundlagen', 'Ökosystem Wald', 'Gesundheit & Prävention'],
                        topics: [
                            {
                                title: 'Von Genen zu Merkmalen',
                                description: 'DNA-Struktur modellieren, Vererbungsregeln auf Alltagsbeispiele anwenden.',
                                competencies: ['Modellbildung', 'Bewerten'],
                                activeMonths: [11, 12, 1],
                                resources: [
                                    { type: 'material', label: 'Schulportal RLP: Genetik', url: 'https://schulportal.rlp.de' }
                                ]
                            },
                            {
                                title: 'Ökosystem Wald & Biodiversität',
                                description: 'Waldrand-Exkursion planen, Nahrungsketten und Eingriffe des Menschen diskutieren.',
                                competencies: ['Ökologisches Denken', 'Präsentieren'],
                                activeMonths: [3, 4, 5],
                                resources: [
                                    { type: 'article', label: 'NABU: Waldpädagogik', url: 'https://www.nabu.de/natur-und-landschaft/wald/' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'history',
                        name: 'Geschichte',
                        focus: ['Industrialisierung', 'Deutsches Kaiserreich', 'Gesellschaftlicher Wandel'],
                        topics: [
                            {
                                title: 'Arbeitswelt in der Industrialisierung',
                                description: 'Quellen zur sozialen Frage analysieren, Gegenwartsbezüge herstellen.',
                                competencies: ['Quellenarbeit', 'Urteilen'],
                                activeMonths: [9, 10, 11],
                                resources: [
                                    { type: 'tutorial', label: 'bpb: Industrialisierung', url: 'https://www.bpb.de/themen/zeit-kulturgeschichte/industrialisierung/' }
                                ]
                            },
                            {
                                title: 'Vom Kaiserreich zur Demokratie',
                                description: 'Nationalstaatsbildung, Kolonialismus und politische Bewegungen recherchieren.',
                                competencies: ['Historisches Denken', 'Argumentieren'],
                                activeMonths: [1, 2, 3],
                                resources: [
                                    { type: 'video', label: 'MrWissen2Go Geschichte', url: 'https://www.youtube.com/watch?v=EsdBqb0C2Ic' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'geography',
                        name: 'Erdkunde',
                        focus: ['Wirtschaftsräume Europas', 'Nachhaltigkeit & Klima', 'Raumplanung'],
                        topics: [
                            {
                                title: 'Europa vernetzt – Logistik & Handel',
                                description: 'Karten auswerten, Standortfaktoren vergleichen, Auswirkungen auf Alltag diskutieren.',
                                competencies: ['Kartenarbeit', 'Globales Denken'],
                                activeMonths: [9, 10, 11],
                                resources: [
                                    { type: 'material', label: 'GeoPortal RLP: Wirtschaft', url: 'https://lvermgeo.rlp.de/de/geodaten/' }
                                ]
                            },
                            {
                                title: 'Klimaanpassung in Städten',
                                description: 'Hitze-Inseln erkennen, Maßnahmen zur nachhaltigen Stadtplanung sammeln.',
                                competencies: ['Problem lösen', 'Projektarbeit'],
                                activeMonths: [4, 5, 6],
                                resources: [
                                    { type: 'tutorial', label: 'Climate Action Project', url: 'https://www.climate-action.info' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'civics',
                        name: 'Sozialkunde',
                        focus: ['Demokratie erleben', 'Medienkompetenz', 'Wirtschaft verstehen'],
                        topics: [
                            {
                                title: 'Landtag RLP & Jugendbeteiligung',
                                description: 'Strukturen des Landtags, Petitionen und Jugendräte kennenlernen, Planspiel durchführen.',
                                competencies: ['Politische Urteilsbildung', 'Teamarbeit'],
                                activeMonths: [9, 10, 11],
                                resources: [
                                    { type: 'material', label: 'Landtag@School', url: 'https://www.landtag.rlp.de/de/parlament/schule/' }
                                ]
                            },
                            {
                                title: 'Medien, Faktencheck & Verbraucherschutz',
                                description: 'Fake News erkennen, Quellen bewerten und rechtliche Grundlagen recherchieren.',
                                competencies: ['Medienkompetenz', 'Wirtschaftsverständnis'],
                                activeMonths: [1, 2, 3],
                                resources: [
                                    { type: 'tutorial', label: 'klicksafe Unterrichtsmaterial', url: 'https://www.klicksafe.de' }
                                ]
                            }
                        ]
                    }
                ]
            },
            '9': {
                lastUpdated: '2024-09-10',
                summary: 'Gymnasium Sekundarstufe I – Kompetenzorientierte Themen',
                subjects: [
                    {
                        id: 'math',
                        name: 'Mathematik',
                        focus: ['Lineare Gleichungssysteme', 'Trigonometrie im Alltag'],
                        topics: [
                            {
                                title: 'LGS mit zwei Variablen',
                                description: 'Gleichungssysteme graphisch, rechnerisch und mit Tabellen lösen, Alltagssituationen modellieren.',
                                competencies: ['Darstellungswechsel', 'Fehlerkontrolle'],
                                resources: [
                                    { type: 'material', label: 'Serlo: LGS', url: 'https://de.serlo.org/mathe/1965/lineare-gleichungssysteme' },
                                    { type: 'video', label: 'Daniel Jung: LGS', url: 'https://www.youtube.com/watch?v=Gfe5u-VPsv4' }
                                ]
                            },
                            {
                                title: 'Sinus und Cosinus in Anwendungen',
                                description: 'Höhenmessung, Schattenlänge und Steigungen mit trigonometrischen Funktionen lösen.',
                                competencies: ['Modellieren', 'Rechner sinnvoll einsetzen'],
                                resources: [
                                    { type: 'tutorial', label: 'GeoGebra Trigonometrie', url: 'https://www.geogebra.org/m/a6tbkvjv' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'german',
                        name: 'Deutsch',
                        focus: ['Literarische Erörterung', 'Sprache untersuchen'],
                        topics: [
                            {
                                title: 'Interpretation moderner Kurzgeschichten',
                                description: 'Erzählperspektive, Stilmittel und Deutungshypothesen strukturiert darstellen.',
                                competencies: ['Textanalyse', 'Argumentation'],
                                resources: [
                                    { type: 'material', label: 'ZUM: Kurzgeschichten', url: 'https://unterrichten.zum.de/wiki/Kurzgeschichte' },
                                    { type: 'video', label: 'Einfach Deutsch: Interpretation', url: 'https://www.youtube.com/watch?v=G_vlJt6PxXo' }
                                ]
                            },
                            {
                                title: 'Sprache in Social Media',
                                description: 'Merkmale von Jugendsprache und Online-Kommunikation analysieren, eigene Texte reflektieren.',
                                competencies: ['Sprachbewusstsein', 'Medienkompetenz'],
                                resources: [
                                    { type: 'article', label: 'bpb: Sprache im Netz', url: 'https://www.bpb.de/themen/medien-journalismus/dossier-medien/' }
                                ]
                            }
                        ]
                    }
                ]
            },
            '12': {
                lastUpdated: '2024-10-05',
                summary: 'Gymnasiale Oberstufe – Schwerpunkt Gesellschaft & Naturwissenschaften',
                subjects: [
                    {
                        id: 'biology',
                        name: 'Biologie (LK/ GK)',
                        focus: ['Genetik', 'Ökologie'],
                        topics: [
                            {
                                title: 'CRISPR und Ethik',
                                description: 'Prinzip der Gen-Schere erklären, Chancen/Risiken diskutieren, ethische Leitfragen sammeln.',
                                competencies: ['Bewerten', 'Fachsprache anwenden'],
                                resources: [
                                    { type: 'video', label: 'MaiLab: CRISPR', url: 'https://www.youtube.com/watch?v=sweN8dNXoyk' },
                                    { type: 'material', label: 'Cornelsen Unterrichtsimpulse', url: 'https://www.cornelsen.de/unterrichtsimpulse' }
                                ]
                            },
                            {
                                title: 'Ökosystem Rheinauen',
                                description: 'Feldstudien planen, Bioindikatoren nutzen und Schutzkonzepte erarbeiten.',
                                competencies: ['Experimentieren', 'Nachhaltigkeit bewerten'],
                                resources: [
                                    { type: 'tutorial', label: 'BUND Rheinauen-Projekt', url: 'https://www.bund-rheinauen.de' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'social',
                        name: 'Sozialkunde',
                        focus: ['Demokratiebildung', 'Europa'],
                        topics: [
                            {
                                title: 'Landtag RLP verstehen',
                                description: 'Arbeitsweise des Landtags, Ausschüsse und Beteiligungsmöglichkeiten für Jugendliche.',
                                competencies: ['Politisch urteilen', 'Argumentieren'],
                                resources: [
                                    { type: 'material', label: 'Landtag@School', url: 'https://www.landtag.rlp.de/de/parlament/schule/' }
                                ]
                            },
                            {
                                title: 'Europa im Alltag',
                                description: 'EU-Programme (Erasmus+, EYP) kennenlernen und eigene Projektidee formulieren.',
                                competencies: ['Projektarbeit', 'Präsentieren'],
                                resources: [
                                    { type: 'tutorial', label: 'Europa macht Schule', url: 'https://www.europamachtschule.de/materialien' }
                                ]
                            }
                        ]
                    }
                ]
            }
        }
    }
};

function findGradeLabel(gradeId) {
    return gradeLevels.find((grade) => grade.id === gradeId)?.label || `Klasse ${gradeId}`;
}

export function getCurriculumEntry(stateId, gradeId) {
    if (!stateId || !gradeId) return null;
    const state = curriculumData[stateId];
    if (!state) return null;
    const grade = state.grades?.[gradeId];
    if (!grade) return null;

    const payload = {
        selection: {
            state: { id: stateId, label: state.label },
            grade: { id: gradeId, label: findGradeLabel(gradeId) }
        },
        subjects: cloneSubjects(grade.subjects || []),
        lastUpdated: grade.lastUpdated || state.lastUpdated || null,
        summary: grade.summary || null,
        source: grade.source || state.source || null
    };

    return applyCurriculumDynamics(stateId, gradeId, payload);
}

function buildStateGradeMap() {
    const map = {};
    for (const [stateId, stateData] of Object.entries(curriculumData)) {
        map[stateId] = Object.keys(stateData.grades || {});
    }
    return map;
}

export function getStateGradeMap() {
    return buildStateGradeMap();
}

export { availableStates, gradeLevels };

function cloneSubjects(subjects = []) {
    return subjects.map(subject => ({
        ...subject,
        focus: Array.isArray(subject.focus) ? [...subject.focus] : subject.focus,
        topics: Array.isArray(subject.topics)
            ? subject.topics.map(topic => ({
                ...topic,
                competencies: Array.isArray(topic.competencies) ? [...topic.competencies] : topic.competencies,
                resources: Array.isArray(topic.resources) ? topic.resources.map(resource => ({ ...resource })) : topic.resources
            }))
            : []
    }));
}

function applyCurriculumDynamics(stateId, gradeId, payload) {
    if (stateId === 'RP' && gradeId === '8') {
        const referenceDate = new Date();
        const filteredSubjects = (payload.subjects || []).map(subject => {
            const filteredTopics = filterTopicsByMonth(subject.topics, referenceDate);
            return { ...subject, topics: filteredTopics };
        });
        const hasTopics = filteredSubjects.some(subject => subject.topics.length);
        return {
            ...payload,
            subjects: hasTopics ? filteredSubjects : payload.subjects,
            lastUpdated: referenceDate.toISOString().split('T')[0],
            summary: 'Gymnasium Klasse 8 · Live abgestimmt auf den aktuellen Unterrichtsmonat'
        };
    }
    return payload;
}

function filterTopicsByMonth(topics = [], referenceDate = new Date()) {
    if (!topics.length) return [];
    const month = referenceDate.getMonth() + 1;
    const active = topics.filter(topic => {
        if (!Array.isArray(topic.activeMonths) || !topic.activeMonths.length) {
            return true;
        }
        return topic.activeMonths.includes(month);
    });
    return active.length ? active : topics;
}

