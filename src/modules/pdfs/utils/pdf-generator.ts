import * as fs from 'fs';
import * as path from 'path';
import * as puppeteer from 'puppeteer';
import Handlebars from '../../../config/handlebars.config';
import { DateUtils } from 'src/common/utils/date.utils';
import { InternalServerErrorException, Logger } from '@nestjs/common';
const logger = new Logger('PdfGeneratorUtils');

async function generatePdf(html: string): Promise<Buffer> {
  let logoBase64 = '';
  const logoPath = path.resolve(__dirname, '..', 'assets', 'LogoPDF.png');
  try {
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    } else {
      console.warn('Logo file not found, proceeding without logo');
    }
  } catch (logoError) {
    console.error('Error loading logo:', logoError);
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const launchOptions: puppeteer.LaunchOptions = { headless: true };

  if (isProduction) {
    launchOptions.executablePath = '/usr/bin/chromium-browser';
    launchOptions.args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ];
  } else {
    launchOptions.executablePath = puppeteer.executablePath();
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const formattedDateForFooter = DateUtils.formatDateTime(
    new Date(),
    "dd/MM/yyyy 'às' HH:mm",
  );

  const pdfOptions: puppeteer.PDFOptions = {
    format: 'A4',
    displayHeaderFooter: Boolean(logoBase64),
    headerTemplate: logoBase64
      ? `<div style="width: 75px; text-align: left; margin: 10px 0px 20px 2cm;"><img src="${logoBase64}" style="max-height: 50px; margin-bottom: 10px;" /></div>`
      : '',
    footerTemplate: `<div style="width: 100%; font-size: 8pt; text-align: center; padding: 10px 0; border-top: 1px solid #ddd;">Gerado pelo Sistema Locaterra em ${formattedDateForFooter}<div style="margin-top: 5px; font-size: 6pt; color: #666;">Página <span class="pageNumber"></span> de <span class="totalPages"></span></div></div>`,
    margin: {
      top: logoBase64 ? '2.5cm' : '1cm',
      bottom: '2.5cm',
      left: '2cm',
      right: '1.5cm',
    },
  };

  const pdfUint8Array = await page.pdf(pdfOptions);
  await browser.close();
  return Buffer.from(pdfUint8Array);
}

/**
 * * Renderiza uma string HTML contendo placeholders Handlebars com os dados fornecidos.
 * @param htmlString A string HTML com placeholders (ex: vinda do banco de dados).
 * @param data Os dados para preencher os placeholders.
 * @returns A string HTML renderizada.
 */
export function renderHtmlFromTemplateString(
  htmlString: string,
  data: any,
): string {
  try {
    const template = Handlebars.compile(htmlString);
    const renderedHtml = template(data);
    return renderedHtml;
  } catch (error) {
    logger.error(
      `Falha ao compilar ou renderizar a string HTML com Handlebars.`,
      error,
    );

    throw new InternalServerErrorException(
      'Ocorreu um erro ao processar o template do contrato.',
    );
  }
}

/**
 * Gera um PDF a partir de um conteúdo HTML completo.
 * @param html O conteúdo HTML a ser convertido em PDF.
 */
export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  try {
    return await generatePdf(html);
  } catch (error) {
    console.error('Error in PDF generation from HTML:', error);
    throw new Error('Failed to generate PDF from HTML');
  }
}

/**
 * Gera um PDF a partir de um template Handlebars e dados.
 * @param templateName O nome do arquivo de template (sem .hbs).
 * @param data Os dados para preencher o template.
 */
export async function generatePdfFromTemplate(
  templateName: string,
  data: any,
): Promise<Buffer> {
  try {
    const templatePath = path.resolve(
      __dirname,
      '..',
      'templates',
      `${templateName}.hbs`,
    );
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(templateContent);
    const html = template(data);
    return await generatePdf(html);
  } catch (error) {
    console.error('Error in PDF generation from template:', error);
    throw new Error('Failed to generate PDF from template');
  }
}
