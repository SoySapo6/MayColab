const express = require('express');
const puppeteer = require('puppeteer');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Variables globales para mantener el estado
let browser = null;
let page = null;
let isRunning = false;
let lastActivity = Date.now();
let keepAliveInterval = null;

// Configuración de comandos
const commands = [
  '!git clone https://github.com/SoySapo6/MaycolAIUltraMD',
  'cd MaycolAIUltraMD',
  'npm install',
  'npm update',
  'npm start'
];

// Función para inicializar el navegador
async function initBrowser() {
  try {
    if (browser) {
      await browser.close();
    }
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });
    
    console.log('✅ Navegador inicializado');
    return true;
  } catch (error) {
    console.error('❌ Error inicializando navegador:', error);
    return false;
  }
}

// Función para parsear cookies desde URL
async function parseCookiesFromUrl(cookiesUrl) {
  try {
    const response = await axios.get(cookiesUrl);
    const cookiesText = response.data;
    
    // Parsear cookies en formato Netscape
    const cookies = [];
    const lines = cookiesText.split('\n');
    
    for (const line of lines) {
      if (line.trim() && !line.startsWith('#')) {
        const parts = line.split('\t');
        if (parts.length >= 7) {
          cookies.push({
            name: parts[5],
            value: parts[6],
            domain: parts[0],
            path: parts[2],
            expires: parts[4] === 'TRUE' ? parseInt(parts[4]) : undefined,
            httpOnly: parts[1] === 'TRUE',
            secure: parts[3] === 'TRUE'
          });
        }
      }
    }
    
    return cookies;
  } catch (error) {
    console.error('❌ Error parseando cookies:', error);
    return [];
  }
}

// Función para ejecutar comandos en Colab
async function executeCommand(command, delay = 2000) {
  try {
    // Buscar y hacer click en la celda de código
    await page.waitForSelector('div[data-type="code"]', { timeout: 10000 });
    await page.click('div[data-type="code"]');
    
    // Limpiar la celda
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await page.keyboard.press('Delete');
    
    // Escribir el comando
    await page.type('div[data-type="code"] .inputarea', command);
    
    // Ejecutar el comando
    await page.keyboard.down('Shift');
    await page.keyboard.press('Enter');
    await page.keyboard.up('Shift');
    
    console.log(`✅ Comando ejecutado: ${command}`);
    
    // Esperar antes del siguiente comando
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return true;
  } catch (error) {
    console.error(`❌ Error ejecutando comando "${command}":`, error);
    return false;
  }
}

// Función principal para mantener Colab activo
async function startColabSession(cookies, cookiesUrl) {
  try {
    if (!browser) {
      const initialized = await initBrowser();
      if (!initialized) return false;
    }
    
    page = await browser.newPage();
    
    // Configurar cookies si se proporcionan
    if (cookies && cookies.length > 0) {
      await page.setCookie(...cookies);
    } else if (cookiesUrl) {
      const parsedCookies = await parseCookiesFromUrl(cookiesUrl);
      if (parsedCookies.length > 0) {
        await page.setCookie(...parsedCookies);
      }
    }
    
    // Navegar a Colab
    console.log('🚀 Navegando a Google Colab...');
    await page.goto('https://colab.new', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Esperar a que cargue la interfaz
    await page.waitForTimeout(5000);
    
    // Ejecutar comandos en orden
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      console.log(`📝 Ejecutando comando ${i + 1}/${commands.length}: ${command}`);
      
      const success = await executeCommand(command, 3000);
      if (!success) {
        console.log(`⚠️ Falló comando ${i + 1}, continuando...`);
      }
      
      lastActivity = Date.now();
    }
    
    console.log('✅ Todos los comandos ejecutados');
    isRunning = true;
    
    // Configurar keep-alive
    setupKeepAlive();
    
    return true;
  } catch (error) {
    console.error('❌ Error en sesión de Colab:', error);
    isRunning = false;
    return false;
  }
}

// Función para mantener activo Colab
function setupKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
  
  keepAliveInterval = setInterval(async () => {
    if (page && !page.isClosed()) {
      try {
        // Hacer click en una celda para mantener activa la sesión
        await page.click('div[data-type="code"]');
        console.log('💓 Keep-alive enviado');
        lastActivity = Date.now();
      } catch (error) {
        console.error('❌ Error en keep-alive:', error);
        // Reintentar iniciar sesión si falló
        setTimeout(restartSession, 5000);
      }
    }
  }, 5 * 60 * 1000); // Cada 5 minutos
}

// Función para reiniciar sesión
async function restartSession() {
  console.log('🔄 Reiniciando sesión...');
  isRunning = false;
  
  try {
    if (page && !page.isClosed()) {
      await page.close();
    }
    
    // Reiniciar con el último comando (npm start)
    const lastCommand = commands[commands.length - 1];
    await executeLastCommand(lastCommand);
    
  } catch (error) {
    console.error('❌ Error reiniciando sesión:', error);
  }
}

// Función para ejecutar solo el último comando
async function executeLastCommand(command) {
  try {
    page = await browser.newPage();
    await page.goto('https://colab.new', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await page.waitForTimeout(3000);
    await executeCommand(command);
    
    isRunning = true;
    setupKeepAlive();
    
    console.log('✅ Último comando ejecutado, sesión restaurada');
  } catch (error) {
    console.error('❌ Error ejecutando último comando:', error);
  }
}

// Endpoint principal
app.post('/start-colab', async (req, res) => {
  try {
    const { cookies, cookiesurl } = req.body;
    
    if (isRunning) {
      return res.json({ 
        success: true, 
        message: 'Colab ya está ejecutándose',
        status: 'running',
        lastActivity: new Date(lastActivity).toISOString()
      });
    }
    
    console.log('🎯 Iniciando nueva sesión de Colab...');
    
    const success = await startColabSession(cookies, cookiesurl);
    
    if (success) {
      res.json({ 
        success: true, 
        message: 'Colab iniciado exitosamente',
        status: 'started',
        commands: commands.length
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Error iniciando Colab',
        status: 'error'
      });
    }
  } catch (error) {
    console.error('❌ Error en endpoint:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor',
      error: error.message 
    });
  }
});

// Endpoint de estado
app.get('/status', (req, res) => {
  res.json({
    isRunning,
    lastActivity: new Date(lastActivity).toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Endpoint para keep-alive externo
app.get('/ping', (req, res) => {
  res.json({ 
    success: true, 
    timestamp: new Date().toISOString(),
    message: 'Server is alive'
  });
});

// Endpoint para reiniciar manualmente
app.post('/restart', async (req, res) => {
  try {
    await restartSession();
    res.json({ 
      success: true, 
      message: 'Sesión reiniciada'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error reiniciando sesión',
      error: error.message
    });
  }
});

// Endpoint raíz
app.get('/', (req, res) => {
  res.json({ 
    message: 'Colab Keeper Server',
    version: '1.0.0',
    endpoints: {
      'POST /start-colab': 'Iniciar sesión de Colab',
      'GET /status': 'Estado del servidor',
      'GET /ping': 'Health check',
      'POST /restart': 'Reiniciar sesión'
    }
  });
});

// Auto-ping para mantener servidor activo en Render
setInterval(async () => {
  try {
    const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    await axios.get(`https://maycolab.onrender.com/ping`);
    console.log('🔄 Auto-ping enviado');
  } catch (error) {
    console.log('⚠️ Auto-ping falló:', error.message);
  }
}, 20 * 60 * 1000); // Cada 20 minutos

// Inicializar servidor
app.listen(PORT, async () => {
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
  console.log('🔧 Inicializando navegador...');
  
  await initBrowser();
  
  console.log('✅ Servidor listo para recibir peticiones');
  console.log('📋 Endpoints disponibles:');
  console.log(`   POST /start-colab - Iniciar Colab`);
  console.log(`   GET /status - Estado del servidor`);
  console.log(`   GET /ping - Health check`);
  console.log(`   POST /restart - Reiniciar sesión`);
});

// Manejo de errores y cierre limpio
process.on('SIGINT', async () => {
  console.log('🛑 Cerrando servidor...');
  
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
  
  if (browser) {
    await browser.close();
  }
  
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});
