const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const db = require('./db'); // Asegúrate de que db.js está en la misma carpeta que index.js
const path = require('path');

const app = express();

// Configuración del motor de plantillas EJS
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Configuración de la sesión
app.use(session({
    store: new pgSession({
        pool: db.pool, // Utilizar el pool importado desde db.js
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

// Ruta para la página de agregar vacante (GET)
app.get('/agregar-vacante', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/agregarV.html'));
});



// Ruta para agregar una nueva vacante (POST)
app.post('/agregar-vacante', async (req, res) => {
    // Verificar si el usuario tiene una sesión válida
    if (!req.session.user) {
        return res.status(401).json({ success: false, error: 'No se ha iniciado sesión' });
    }

    // Obtener el id y el nombre de la empresa desde la sesión
    const empresaId = req.session.user.id;
    const nombreEmpresa = req.session.user.nombre;
    const { titulo, descripcion, fechaCierre } = req.body;

    try {
        // Insertar la nueva vacante en la base de datos
        const result = await db.pool.query(
            'INSERT INTO vacante (empresa_id, nombre_empresa, titulo, descripcion, fecha_cierre) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [empresaId, nombreEmpresa, titulo, descripcion, fechaCierre]
        );
        
        // Obtener el ID de la vacante insertada
        const nuevaVacanteId = result.rows[0].id;

        // Enviar una respuesta de éxito con el ID de la vacante insertada
        res.json({ success: true, vacanteId: nuevaVacanteId });
    } catch (error) {
        console.error('Error al agregar vacante:', error);
        // Enviar una respuesta de error
        res.status(500).json({ success: false, error: 'Error al agregar vacante' });
    }
});




// Ruta para visualizar el perfil del usuario
app.get('/perfil', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/public/login.html'); // Redirigir a la página de inicio de sesión si no hay usuario en la sesión
    }
    const { id, nombre, email, rol } = req.session.user;
    res.render('perfil', { id, nombre, email, rol });
});



app.get('/views/home.ejs', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login'); // Redirigir a la página de inicio de sesión si no hay usuario en la sesión
    }
    const nombreUsuario = req.session.user.nombre;
    const rolUsuario = req.session.user.rol;

    try {
        // Consultar las últimas 4 vacantes disponibles ordenadas por fecha de publicación
        const { rows } = await db.pool.query(
            `SELECT v.*, u.nombre AS nombre_empresa 
             FROM vacante v
             JOIN usuarios u ON v.empresa_id = u.id
             ORDER BY v.fecha_publicacion DESC
             LIMIT 4`
        );
        const destacados = rows;
        res.render('home', { nombreUsuario, rolUsuario, destacados });
    } catch (error) {
        console.error('Error al obtener vacantes destacadas:', error);
        // Manejar el error
        res.render('home', { nombreUsuario, rolUsuario, destacados: [] }); // Pasar un array vacío en caso de error
    }
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

// Ruta de inicio de sesión
app.post('/login', async (req, res) => {
    const { email, contraseña } = req.body;

    try {
        const result = await db.pool.query('SELECT * FROM usuarios WHERE email = $1 AND contraseña = $2', [email, contraseña]);

        if (result.rows.length > 0) {
            const user = result.rows[0];
            req.session.user = { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol }; // Añadir el email a la sesión
            res.json({ message: 'Inicio de sesión exitoso' });
        } else {
            res.status(401).json({ error: 'Credenciales inválidas' });
        }
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
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
