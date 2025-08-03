import * as fs from 'fs';
import * as path from 'path';
import * as puppeteer from 'puppeteer';
import Handlebars from '../../../config/handlebars.config';

export async function generatePdfFromTemplate(templateName: string, data: any) {
  try {
    const templatePath = path.join(
      __dirname,
      '../templates',
      `${templateName}.hbs`,
    );

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }

    const templateContent = fs.readFileSync(templatePath, 'utf8');

    let logoBase64 = '';
    const logoPath = path.join(__dirname, '../assets/LogoPDF.png');

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

    const template = Handlebars.compile(templateContent);
    const html = template({
      ...data,
      logoBase64,
    });

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfOptions: puppeteer.PDFOptions = {
      format: 'A4',
      displayHeaderFooter: Boolean(logoBase64),
      headerTemplate: logoBase64
        ? `
                <div style="width: 75px; text-align: left; margin: 10px 0px 20px 2cm;">
                    <img src="${logoBase64}" style="max-height: 50px; margin-bottom: 10px;" />
                </div>
            `
        : '',
      footerTemplate: `
                <div style="width: 100%; font-size: 8pt; text-align: center; padding: 10px 50px 0px; border-top: 1px solid #ddd;">
                    <div>Arqtª Cinara Gonçalves (11) 98015-7566 — Engª Bárbara Gonçalves (11) 97960-5000 — Engº Vinicius Gonçalves (11) 98310-2161</div>
                    <div style="margin-top: 5px;"><a href="https://www.fagon.com.br/" style="color: #000;">www.fagon.com.br</a></div>
                    <div style="margin-top: 5px;">End.: Rua da Fraternidade, 53 Osasco - SP — tel.: (011) 4386-8746</div>
                    <div style="margin-top: 5px; font-size: 6pt; color: #666;">Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>
                </div>
            `,
      margin: {
        top: logoBase64 ? '2.5cm' : '1cm',
        bottom: '2.5cm',
        left: '2cm',
        right: '1.5cm',
      },
    };

    const pdfBuffer = await page.pdf(pdfOptions);
    await browser.close();

    return pdfBuffer;
  } catch (error) {
    console.error('Error in PDF generation:', error);
    throw new Error('Failed to generate PDF');
  }
}
