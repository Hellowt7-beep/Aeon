import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_SLIDE_COUNT = 8;
const MIN_SLIDE_COUNT = 4;
const MAX_SLIDE_COUNT = 15;

const PRESENTATION_REGEX = /(pr(ä|ae)sentation|presentation|powerpoint|pptx|odf|odp)/i;
const PRESENTATION_VERBS = /(erstell|generier|mach|baue|konzipier|schreib|bau|plane|produce|create)/i;

export function detectPresentationIntent(message = '') {
    if (!message) return null;
    const normalized = message.trim().toLowerCase();
    const hasKeyword = PRESENTATION_REGEX.test(normalized);
    const hasVerb = PRESENTATION_VERBS.test(normalized);

    if (!hasKeyword || !hasVerb) return null;

    let format = 'pptx';
    if (/od[fp]|open[\s-]*office/.test(normalized)) {
        format = 'odp';
    }
    if (/pptx|powerpoint/.test(normalized) && /odp|odf|open[\s-]*office/.test(normalized)) {
        format = 'both';
    } else if (/both|beide/.test(normalized)) {
        format = 'both';
    }

    const topicMatch = normalized.match(/(?:über|about)\s+(.+)/i);
    const topic = topicMatch ? topicMatch[1].trim() : '';

    return {
        format,
        topic: topic || message.replace(PRESENTATION_REGEX, '').trim(),
    };
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function stripJsonFences(raw = '') {
    return raw
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .trim();
}

function escapeXml(value = '') {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function slugify(value = '') {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 40) || 'presentation';
}

function clampSlides(slides = []) {
    if (!Array.isArray(slides) || slides.length === 0) return [];
    const trimmed = slides.slice(0, MAX_SLIDE_COUNT);
    while (trimmed.length < MIN_SLIDE_COUNT) {
        trimmed.push({
            title: `Zusatzfolie ${trimmed.length}`,
            bullets: ['Weitere Informationen', 'Zusätzliche Erkenntnisse'],
            notes: '',
        });
    }
    return trimmed;
}

export class PresentationService {
    constructor({ multiAI = null, outputDir = path.join(__dirname, 'public', 'generated', 'presentations') } = {}) {
        this.multiAI = multiAI;
        this.outputDir = outputDir;
        ensureDir(this.outputDir);
    }

    async createPresentation({
        requestText,
        topic,
        preferredFormat = 'pptx',
        language = 'de',
        requestedBy = 'dashboard',
        slidesCount = DEFAULT_SLIDE_COUNT
    } = {}) {
        const plan = await this.generatePlan({
            requestText,
            topic,
            language,
            slidesCount
        });

        const formats = preferredFormat === 'both' ? ['pptx', 'odp'] : [preferredFormat || 'pptx'];

        const results = {};

        for (const format of formats) {
            if (format === 'pptx') {
                const buffer = await this.createPptx(plan);
                const meta = await this.persistBuffer(buffer, plan, 'pptx');
                results.pptx = { ...meta, buffer };
            } else if (format === 'odp') {
                const buffer = await this.createOdp(plan);
                const meta = await this.persistBuffer(buffer, plan, 'odp');
                results.odp = { ...meta, buffer };
            }
        }

        const summaryLines = [
            `🎞️ Präsentation **${plan.title}** erstellt.`,
            plan.summary ? `**Kurzüberblick:** ${plan.summary}` : '',
            `Enthält ${plan.slides.length} Folien, Tonalität: ${plan.tone}.`
        ].filter(Boolean);

        return {
            title: plan.title,
            subtitle: plan.subtitle,
            summary: plan.summary,
            tone: plan.tone,
            slides: plan.slides,
            files: results,
            textualSummary: summaryLines.join('\n'),
            requestedBy
        };
    }

    async generatePlan({ requestText = '', topic = '', language = 'de', slidesCount = DEFAULT_SLIDE_COUNT } = {}) {
        const cleanTopic = topic || this.extractTopic(requestText);
        const prompt = `
Du bist ein professioneller Präsentationsdesigner für ${language.toUpperCase()}.
Erstelle eine strukturierte Präsentation als JSON mit folgendem Format (KEINE Erklärungen, NUR JSON!):
{
  "title": "...",
  "subtitle": "...",
  "summary": "...",
  "tone": "professionell / inspirierend / sachlich / kreativ",
  "slides": [
    {
      "title": "...",
      "bullets": ["...", "..."],
      "notes": "Sprechernotizen oder Hinweise"
    }
  ],
  "callToAction": "..."
}

Vorgaben:
- Thema: ${cleanTopic || 'Präsentation nach Kundenvorgabe'}
- Sprache: ${language}
- Verwende zwischen ${Math.max(MIN_SLIDE_COUNT, Math.min(slidesCount, MAX_SLIDE_COUNT))} und ${MAX_SLIDE_COUNT} Folien
- Jede Folie max. 5 Kernpunkte
- Mix aus Fakten, Storytelling, und klarer Handlungsempfehlung
- Tonfall: modern, vertrauenswürdig, optisch inspirierend
- Füge passende Emojis in Bullets ein, aber maximal eins pro Bullet
- Schlage Titel- und Abschlussfolie automatisch vor

Anfrage des Nutzers:
"${requestText}"
        `.trim();

        let response = null;
        if (this.multiAI) {
            try {
                response = await this.multiAI.generateSingleModelResponse('gpt-oss-120b', {
                    userMessage: prompt,
                    history: [],
                    isSchoolTopic: false,
                    userSettings: {}
                });
            } catch (error) {
                console.error('⚠️ Präsentationsplan via KI fehlgeschlagen:', error.message);
            }
        }

        const plan = this.parsePlanResponse(response) || this.buildFallbackPlan(cleanTopic);
        plan.slides = clampSlides(plan.slides);
        return plan;
    }

    parsePlanResponse(response) {
        if (!response) return null;
        let raw = typeof response === 'string' ? response : response.response || '';
        if (!raw) return null;
        const cleaned = stripJsonFences(raw);

        try {
            const parsed = JSON.parse(cleaned);
            if (!parsed || !Array.isArray(parsed.slides)) {
                return null;
            }
            return {
                title: parsed.title || 'Individuelle Präsentation',
                subtitle: parsed.subtitle || '',
                summary: parsed.summary || '',
                tone: parsed.tone || 'professionell',
                slides: parsed.slides.map(slide => ({
                    title: slide.title || 'Folie',
                    bullets: Array.isArray(slide.bullets) ? slide.bullets : [],
                    notes: slide.notes || ''
                }))
            };
        } catch (error) {
            console.error('⚠️ Konnte Präsentations-JSON nicht parsen:', error.message);
            return null;
        }
    }

    buildFallbackPlan(topic = 'Individuelles Thema') {
        const baseSlides = [
            {
                title: 'Agenda',
                bullets: [
                    'Ausgangssituation und Zielsetzung',
                    'Strategischer Ansatz',
                    'Konkrete Maßnahmen',
                    'Erwartete Ergebnisse'
                ],
                notes: ''
            },
            {
                title: 'Ausgangssituation',
                bullets: [
                    'Aktuelle Trends und Entwicklungen',
                    'Herausforderungen im Fokus',
                    'Chancen für nachhaltiges Wachstum'
                ],
                notes: ''
            },
            {
                title: 'Strategische Leitplanken',
                bullets: [
                    'Fokus auf Nutzer*innen-Mehrwert',
                    'Datenbasierte Entscheidungen',
                    'Iterative, lernende Umsetzung'
                ],
                notes: ''
            },
            {
                title: 'Maßnahmenplan',
                bullets: [
                    'Kurze Quick-Wins zur Aktivierung',
                    'Mittelfristige Skalierungspfade',
                    'Langfristige Differenzierung'
                ],
                notes: ''
            },
            {
                title: 'Erfolgskennzahlen',
                bullets: [
                    'Reichweite & Engagement',
                    'Conversion & Bindung',
                    'Zufriedenheit & Empfehlungen'
                ],
                notes: ''
            },
            {
                title: 'Nächste Schritte',
                bullets: [
                    'Pilotphase definieren',
                    'Stakeholder onboarden',
                    'Ressourcen sichern'
                ],
                notes: ''
            }
        ];

        return {
            title: `Präsentation: ${topic}`,
            subtitle: 'Professionelle Storyline',
            summary: `Strategische Präsentation zum Thema "${topic}"`,
            tone: 'professionell',
            slides: baseSlides
        };
    }

    extractTopic(text = '') {
        if (!text) return 'Individuelles Thema';
        const cleaned = text.replace(PRESENTATION_REGEX, '').trim();
        return cleaned || 'Individuelles Thema';
    }

    async createPptx(plan) {
        const pptx = new PptxGenJS();
        pptx.layout = 'LAYOUT_WIDE';

        const theme = this.pickTheme(plan.tone);

        // Cover
        const cover = pptx.addSlide();
        cover.background = { color: theme.background };
        cover.addText(plan.title, {
            x: 0.5,
            y: 1.2,
            w: 12,
            h: 1.5,
            fontSize: 36,
            color: theme.primaryText,
            bold: true
        });
        if (plan.subtitle) {
            cover.addText(plan.subtitle, {
                x: 0.5,
                y: 2.8,
                w: 10,
                h: 1,
                fontSize: 20,
                color: theme.secondaryText
            });
        }

        plan.slides.forEach((slide, index) => {
            const s = pptx.addSlide();
            s.background = { color: theme.slideBackground };
            s.addShape(pptx.ShapeType.rect, {
                x: 0,
                y: 0,
                w: '100%',
                h: 0.6,
                fill: { color: theme.accent },
                line: { color: theme.accent }
            });
            s.addText(slide.title || `Folie ${index + 1}`, {
                x: 0.6,
                y: 0.15,
                fontSize: 22,
                color: theme.strongText,
                bold: true
            });
            const bulletText = (slide.bullets || []).map(item => `• ${item}`).join('\n');
            s.addText(bulletText || 'Details folgen', {
                x: 0.8,
                y: 1,
                w: 11,
                h: 5,
                fontSize: 18,
                color: theme.bodyText,
                lineSpacing: 28
            });
            if (slide.notes) {
                s.notes = slide.notes;
            }
        });

        // Closing Slide
        const outro = pptx.addSlide();
        outro.background = { color: theme.background };
        outro.addText('Vielen Dank!', {
            x: 1,
            y: 2.5,
            w: 10,
            h: 1,
            align: 'center',
            fontSize: 34,
            bold: true,
            color: theme.primaryText
        });
        if (plan.callToAction) {
            outro.addText(plan.callToAction, {
                x: 1.2,
                y: 3.4,
                w: 9.5,
                h: 1,
                align: 'center',
                fontSize: 20,
                color: theme.secondaryText
            });
        }

        return pptx.write('nodebuffer');
    }

    pickTheme(tone = 'professionell') {
        switch ((tone || '').toLowerCase()) {
            case 'kreativ':
                return {
                    background: '10172a',
                    slideBackground: '0f111a',
                    accent: 'f97316',
                    primaryText: 'f8fafc',
                    secondaryText: '94a3b8',
                    strongText: 'f97316',
                    bodyText: 'e2e8f0'
                };
            case 'inspirierend':
                return {
                    background: '0f172a',
                    slideBackground: '111827',
                    accent: '38bdf8',
                    primaryText: 'e2e8f0',
                    secondaryText: '94a3b8',
                    strongText: '38bdf8',
                    bodyText: 'cbd5f5'
                };
            default:
                return {
                    background: '0f0f23',
                    slideBackground: '181826',
                    accent: '8b5cf6',
                    primaryText: 'f8fafc',
                    secondaryText: '94a3b8',
                    strongText: 'f8fafc',
                    bodyText: 'd9e3ff'
                };
        }
    }

    async createOdp(plan) {
        const zip = new JSZip();
        zip.file('mimetype', 'application/vnd.oasis.opendocument.presentation', { compression: 'STORE' });
        zip.file('meta.xml', this.buildMetaXml(plan));
        zip.file('styles.xml', this.buildStylesXml());
        zip.file('settings.xml', this.buildSettingsXml());
        zip.file('content.xml', this.buildContentXml(plan));
        zip.folder('META-INF').file('manifest.xml', this.buildManifestXml());
        return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    }

    buildMetaXml(plan) {
        const now = new Date().toISOString();
        return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:ooo="http://openoffice.org/2004/office" office:version="1.2">
  <office:meta>
    <dc:title>${escapeXml(plan.title || 'Präsentation')}</dc:title>
    <dc:date>${now}</dc:date>
    <meta:generator>Aeon Presentation Engine</meta:generator>
  </office:meta>
</office:document-meta>`;
    }

    buildStylesXml() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" office:version="1.2">
  <office:styles>
    <style:style style:name="standard" style:family="presentation">
      <style:paragraph-properties fo:margin-left="0cm" fo:margin-right="0cm"/>
    </style:style>
  </office:styles>
  <office:master-styles>
    <style:master-page style:name="Standard" draw:style-name="dp1"/>
  </office:master-styles>
</office:document-styles>`;
    }

    buildSettingsXml() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-settings xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0">
  <office:settings>
    <config:config-item-set config:name="ooo:view-settings"/>
    <config:config-item-set config:name="ooo:configuration-settings"/>
  </office:settings>
</office:document-settings>`;
    }

    buildContentXml(plan) {
        const slidesXml = plan.slides.map((slide, index) => this.buildSlideXml(slide, index)).join('\n');
        return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2">
  <office:automatic-styles>
    <style:style style:name="dp1" style:family="drawing-page">
      <style:drawing-page-properties draw:background-size="full"/>
    </style:style>
    <style:style style:name="grTitle" style:family="graphic">
      <style:graphic-properties style:protect="size position" draw:textarea-vertical-align="middle"/>
      <style:text-properties fo:font-size="28pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="grBody" style:family="graphic">
      <style:graphic-properties style:protect="size position"/>
      <style:text-properties fo:font-size="18pt"/>
    </style:style>
    <text:list-style style:name="L1">
      <text:list-level-style-bullet text:level="1" text:bullet-char="•">
        <style:text-properties fo:font-size="18pt"/>
      </text:list-level-style-bullet>
    </text:list-style>
    <style:style style:name="P1" style:family="paragraph"/>
    <style:style style:name="P2" style:family="paragraph"/>
  </office:automatic-styles>
  <office:body>
    <office:presentation>
      ${slidesXml}
    </office:presentation>
  </office:body>
</office:document-content>`;
    }

    buildSlideXml(slide, index) {
        const yTitle = 1 + index * 0;
        const bulletItems = (slide.bullets || []).map(bullet => `
            <text:list-item>
              <text:p text:style-name="P2">${escapeXml(bullet)}</text:p>
            </text:list-item>`).join('');

        return `<draw:page draw:name="page${index + 1}" draw:style-name="dp1" draw:master-page-name="Standard">
  <draw:frame draw:style-name="grTitle" draw:text-style-name="P1" svg:x="2cm" svg:y="${yTitle}cm" svg:width="25cm" svg:height="3cm">
    <draw:text-box>
      <text:p text:style-name="P1">${escapeXml(slide.title || `Folie ${index + 1}`)}</text:p>
    </draw:text-box>
  </draw:frame>
  <draw:frame draw:style-name="grBody" draw:text-style-name="P2" svg:x="2cm" svg:y="4.5cm" svg:width="25cm" svg:height="12cm">
    <draw:text-box>
      <text:list text:style-name="L1">
        ${bulletItems}
      </text:list>
    </draw:text-box>
  </draw:frame>
</draw:page>`;
    }

    buildManifestXml() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <manifest:file-entry manifest:media-type="application/vnd.oasis.opendocument.presentation" manifest:full-path="/"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="content.xml"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="styles.xml"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="meta.xml"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="settings.xml"/>
</manifest:manifest>`;
    }

    async persistBuffer(buffer, plan, extension) {
        const id = randomUUID();
        const slug = slugify(plan.title);
        const fileName = `${slug}-${id}.${extension}`;
        const targetPath = path.join(this.outputDir, fileName);

        await fs.promises.writeFile(targetPath, buffer);

        return {
            filename: fileName,
            path: targetPath,
            url: `/generated/presentations/${fileName}`,
            size: buffer.length,
            mimeType: extension === 'pptx'
                ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                : 'application/vnd.oasis.opendocument.presentation'
        };
    }
}

