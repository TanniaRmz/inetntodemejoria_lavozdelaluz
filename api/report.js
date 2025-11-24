// api/report.js
// Requiere la librería axios: npm install axios
const axios = require('axios');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 
const GITHUB_OWNER = 'TanniaRmZ'; // Tu usuario
const GITHUB_REPO = 'lavozdelaluz_lumibot'; // Tu repositorio
const REPORTS_PATH = 'reports'; // Carpeta para los JSON de reportes
const IMAGES_PATH = 'reports/images'; // ¡Carpeta para las imágenes!

module.exports = async (req, res) => {
    // Solo acepta peticiones POST
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const reportData = req.body;
    const folio = reportData.folio;
    const imagenBase64 = reportData.imagenBase64; 
    const imagenNombre = reportData.imagenNombre; 

    if (!folio || !reportData.direccion) {
        return res.status(400).json({ success: false, message: 'Missing Folio or Address' });
    }

    let githubImageUrl = 'No adjuntada'; 

    try {
        // --- 1. Subir la imagen a GitHub (si existe) ---
        if (imagenBase64 && imagenNombre) {
            // Genera un nombre único para la imagen basado en folio y timestamp
            const fileExtension = imagenNombre.split('.').pop();
            const imageFileName = `${folio}-${Date.now()}.${fileExtension}`;
            const imageFilePath = `${IMAGES_PATH}/${imageFileName}`;
            
            try {
                const imageUploadResponse = await axios.put(
                    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${imageFilePath}`,
                    {
                        message: `[Lumi-Bot] Imagen para Reporte #${folio}`,
                        content: imagenBase64, // El contenido Base64 de la imagen
                        branch: 'main'
                    },
                    {
                        headers: {
                            'Authorization': `token ${GITHUB_TOKEN}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                if (imageUploadResponse.status === 201) {
                    // Crea la URL raw de GitHub para que la imagen se pueda ver públicamente
                    githubImageUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/${imageFilePath}`;
                } else {
                    console.warn('Error al subir la imagen a GitHub, status:', imageUploadResponse.status);
                    githubImageUrl = 'Error al subir la imagen';
                }
            } catch (imageError) {
                console.error('Fallo al subir imagen a GitHub:', imageError.message);
                if (imageError.response) {
                    console.error('Detalles del error de imagen:', imageError.response.data);
                }
                githubImageUrl = 'Error al subir la imagen';
            }
        }

        // --- 2. Crear el archivo JSON del reporte en GitHub ---
        
        // Creamos la versión final del reporte para el JSON, usando la URL de la imagen
        const finalReportData = {
            folio: reportData.folio,
            fecha: reportData.fecha,
            direccion: reportData.direccion,
            descripcion_falla: reportData.descripcion_falla,
            ubicacionGPS: reportData.ubicacionGPS,
            imagenURL: githubImageUrl, // ¡Contiene la URL pública de la imagen!
            estado: reportData.estado
        };

        const fileContent = JSON.stringify(finalReportData, null, 4);
        const encodedContent = Buffer.from(fileContent).toString('base64');
        const reportFileName = `${folio}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`;
        const reportFilePath = `${REPORTS_PATH}/${reportFileName}`;

        const reportUploadResponse = await axios.put(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${reportFilePath}`,
            {
                message: `[Lumi-Bot] Reporte de Falla #${folio}`,
                content: encodedContent,
                branch: 'main'
            },
            {
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (reportUploadResponse.status === 201) {
            console.log(`Reporte JSON creado: ${reportFilePath}`);
            return res.status(201).json({ success: true, message: 'Report and image saved to GitHub', folio: folio, imageUrl: githubImageUrl });
        } else {
            console.error('Error al subir el reporte JSON, status:', reportUploadResponse.status);
            return res.status(500).json({ success: false, message: 'GitHub API error for JSON report', githubStatus: reportUploadResponse.status });
        }

    } catch (error) {
        console.error('Error general durante el proceso:', error.message);
        if (error.response) {
            console.error('Detalles de la respuesta de GitHub:', error.response.data);
            return res.status(error.response.status).json({ success: false, message: 'GitHub API response error', details: error.response.data });
        }
        return res.status(500).json({ success: false, message: 'Server or Network Error', details: error.message });
    }
};
