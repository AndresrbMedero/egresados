const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const db = require('./db');
const path = require('path');

const app = express();

// Configuración del motor de plantillas EJS
app.set('views', path.join(__dirname, 'views'));

app.set('view engine', 'ejs');

// Configuración de la sesión
app.use(session({
    store: new pgSession({
        pool: db.pool,
        tableName: 'sesiones'
    }),
    secret: 'secreto',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 días
}));

app.use(express.json());

// Rutas estáticas
app.use(express.static('public'));

// Ruta para la página de inicio
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta para la página de registro
app.get('/public/registro.html', (req, res) => {
    res.sendFile(path.join(__dirname, '/public/registro.html'));
});

// Ruta para la página de inicio de sesión
app.get('/public/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/login.html'));
});

// Ruta para la página principal después del inicio de sesión
app.get('/views/home.ejs', (req, res) => {
    // Obtener el nombre del usuario de la sesión
    const nombreUsuario = req.session.nombreUsuario;
    // Renderizar la página 'home.ejs' y pasar 'nombreUsuario' como una variable
    res.render('home', { nombreUsuario: nombreUsuario }); // O simplemente { nombreUsuario } si la clave y el valor tienen el mismo nombre
});


// Ruta para registrar un nuevo usuario
app.post('/registro', async (req, res) => {
    const { nombre, email, contraseña, rol } = req.body;
    try {
        // Verificar si el correo electrónico ya está registrado
        const { rows } = await db.pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (rows.length > 0) {
            // El correo electrónico ya está registrado, enviar un error
            return res.status(400).json({ error: 'El correo electrónico ya está en uso' });
        }

        // Si el correo electrónico no está registrado, proceder con la inserción
        const result = await db.pool.query('INSERT INTO usuarios (nombre, email, contraseña, rol) VALUES ($1, $2, $3, $4) RETURNING id', [nombre, email, contraseña, rol]);
        const nuevoUsuarioId = result.rows[0].id;
        // Enviar una respuesta de éxito con el ID del usuario insertado
        res.status(201).json({ usuario: nuevoUsuarioId }); // 201 Created
    } catch (error) {
        console.error('Error al registrar usuario:', error);
        // Enviar una respuesta de error
        res.status(500).json({ error: 'Error al registrar usuario' });
    }
});

app.post('/login', async (req, res) => {
    const { email, contraseña } = req.body;
    try {
        // Verificar si el correo electrónico y la contraseña coinciden con algún usuario en la base de datos
        const { rows } = await db.pool.query('SELECT nombre FROM usuarios WHERE email = $1 AND contraseña = $2', [email, contraseña]);
        if (rows.length === 0) {
            // Si no se encuentra un usuario con las credenciales proporcionadas, devolver un error de credenciales inválidas
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        // Si se encuentra el usuario, iniciar sesión y enviar el nombre
        const nombreUsuario = rows[0].nombre;
        // Almacenar el nombre de usuario en la sesión
        req.session.nombreUsuario = nombreUsuario;
        // Enviar una respuesta de éxito con el mensaje de bienvenida y el nombre de usuario
        res.json({ mensaje: `¡Bienvenido de nuevo, ${nombreUsuario}!` });
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        // Enviar una respuesta de error en caso de problemas con la base de datos u otros errores
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});


// Puerto del servidor
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});

// Manejo de la interrupción del proceso para cerrar el servidor correctamente
process.on('SIGINT', () => {
    server.close(() => {
        console.log('Servidor cerrado correctamente');
        process.exit(0);
    });
});
