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
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
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




app.get('/perfil', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/public/login.html');
    }
    const { id, nombre, email, rol } = req.session.user;

    try {
        let vacantes = [];
        if (rol === 'egresado') {
            // Obtener las vacantes a las que el egresado se ha postulado
            const { rows } = await db.pool.query(`
                SELECT v.*, u.nombre AS nombre_empresa 
                FROM vacante v
                JOIN usuarios u ON v.empresa_id = u.id
                WHERE v.egresado_id = $1
            `, [id]);
            vacantes = rows;
        } else if (rol === 'empresa') {
            // Obtener las vacantes dadas de alta por la empresa
            const { rows } = await db.pool.query(`
                SELECT v.*, u.nombre AS nombre_egresado
                FROM vacante v
                LEFT JOIN usuarios u ON v.egresado_id = u.id
                WHERE v.empresa_id = $1
            `, [id]);
            vacantes = rows;
        }
        res.render('perfil', { id, nombre, email, rol, vacantes });
    } catch (error) {
        console.error('Error al obtener vacantes:', error);
        res.render('perfil', { id, nombre, email, rol, vacantes: [] });
    }
});

// Ruta para cerrar sesión
app.get('/logout', (req, res) => {
    // Destruir la sesión del usuario
    req.session.destroy((err) => {
        if (err) {
            console.error('Error al cerrar sesión:', err);
            return res.status(500).json({ error: 'Error al cerrar sesión' });
        }
        // Redirigir al usuario a la página de inicio de sesión
        res.redirect('/public/login.html');
    });
});




async function obtenerTodasLasVacantes() {
    try {
        // Realizar la consulta a la base de datos para obtener todas las vacantes disponibles
        const { rows } = await db.pool.query('SELECT * FROM vacante');
        return rows; // Devolver las vacantes obtenidas
    } catch (error) {
        throw error; // Relanzar el error para manejarlo en el controlador de la ruta
    }
}


// Ruta para buscar vacantes
app.get('/buscar-empleos', async (req, res) => {
    try {
        const { rows } = await db.pool.query('SELECT * FROM vacante');
        const vacantes = rows;
        res.render('buscarEmpleos', { vacantes });
    } catch (error) {
        console.error('Error al buscar vacantes:', error);
        res.status(500).send('Error al buscar vacantes');
    }
});






app.get('/views/home.ejs', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }app.get('/home', async (req, res) => {
        if (!req.session.user) {
            return res.redirect('/login');
        }
        const usuarioId = req.session.user.id;
        const nombreUsuario = req.session.user.nombre;
        const rolUsuario = req.session.user.rol;
    
        try {
            const { rows } = await db.pool.query(
                `SELECT v.*, u.nombre AS nombre_empresa, v.empresa_id = $1 AS es_creador
                 FROM vacante v
                 JOIN usuarios u ON v.empresa_id = u.id
                 ORDER BY v.fecha_publicacion DESC
                 LIMIT 4`,
                [usuarioId]
            );
            const destacados = rows;
            res.render('home', { nombreUsuario, rolUsuario, destacados });
        } catch (error) {
            console.error('Error al obtener vacantes destacadas:', error);
            res.render('home', { nombreUsuario, rolUsuario, destacados: [] });
        }
    });
    
    const usuarioId = req.session.user.id;
    const nombreUsuario = req.session.user.nombre;
    const rolUsuario = req.session.user.rol;

    try {
        // Consultar las últimas 4 vacantes disponibles ordenadas por fecha de publicación
        const { rows } = await db.pool.query(
            `SELECT v.*, u.nombre AS nombre_empresa, v.empresa_id = $1 AS es_creador
             FROM vacante v
             JOIN usuarios u ON v.empresa_id = u.id
             ORDER BY v.fecha_publicacion DESC
             LIMIT 4`,
            [usuarioId]
        );
        const destacados = rows;
        res.render('home', { nombreUsuario, rolUsuario, destacados });
    } catch (error) {
        console.error('Error al obtener vacantes destacadas:', error);
        // Manejar el error
        res.render('home', { nombreUsuario, rolUsuario, destacados: [] }); // Pasar un array vacío en caso de error
    }
});


app.delete('/eliminar-vacante/:id', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'No autorizado' }); // Verificar si el usuario está autenticado
    }
    const usuarioId = req.session.user.id;
    const vacanteId = req.params.id;

    try {
        // Verificar si la vacante pertenece al usuario actual
        const { rows } = await db.pool.query('SELECT * FROM vacante WHERE id = $1 AND empresa_id = $2', [vacanteId, usuarioId]);
        if (rows.length === 0) {
            return res.status(403).json({ error: 'No autorizado para eliminar esta vacante' });
        }

        // Eliminar la vacante
        await db.pool.query('DELETE FROM vacante WHERE id = $1', [vacanteId]);
        res.status(200).json({ message: 'Vacante eliminada exitosamente' });
    } catch (error) {
        console.error('Error al eliminar vacante:', error);
        res.status(500).json({ error: 'Error al eliminar vacante' });
    }
});

app.post('/postularse-vacante/:id', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    const usuarioId = req.session.user.id;
    const rolUsuario = req.session.user.rol;
    const vacanteId = req.params.id;

    if (rolUsuario !== 'egresado') {
        return res.status(403).json({ error: 'Solo los egresados pueden postularse' });
    }

    try {
        // Verificar si la vacante ya tiene un egresado postulado
        const { rows } = await db.pool.query('SELECT * FROM vacante WHERE id = $1 AND egresado_id IS NULL', [vacanteId]);
        if (rows.length === 0) {
            return res.status(400).json({ error: 'La vacante no está disponible para postulación o ya tiene un egresado' });
        }

        // Actualizar la vacante con el id del egresado
        await db.pool.query('UPDATE vacante SET egresado_id = $1 WHERE id = $2', [usuarioId, vacanteId]);
        res.status(200).json({ message: 'Postulación exitosa' });
    } catch (error) {
        console.error('Error al postularse a la vacante:', error);
        res.status(500).json({ error: 'Error al postularse a la vacante' });
    }
});


// Ruta para el perfil de la empresa
app.get('/perfil-empresa/:id', async (req, res) => {
    const empresaId = req.params.id;
    try {
        // Consulta para obtener la información de la empresa
        const { rows } = await db.pool.query('SELECT * FROM usuarios WHERE id = $1 AND rol = $2', [empresaId, 'empresa']);
        if (rows.length === 0) {
            return res.status(404).send('Empresa no encontrada');
        }
        const empresa = rows[0];
        // Renderizar la vista del perfil de la empresa
        res.render('perfilEmpresa', { empresa });
    } catch (error) {
        console.error('Error al obtener el perfil de la empresa:', error);
        res.status(500).send('Error al obtener el perfil de la empresa');
    }
});

// Ruta para el perfil del egresado
app.get('/perfil-egresado/:id', async (req, res) => {
    const egresadoId = req.params.id;
    try {
        // Consulta para obtener la información del egresado
        const { rows } = await db.pool.query('SELECT * FROM usuarios WHERE id = $1 AND rol = $2', [egresadoId, 'egresado']);
        if (rows.length === 0) {
            return res.status(404).send('Egresado no encontrado');
        }
        const egresado = rows[0];
        // Renderizar la vista del perfil del egresado
        res.render('perfilEgresado', { egresado });
    } catch (error) {
        console.error('Error al obtener el perfil del egresado:', error);
        res.status(500).send('Error al obtener el perfil del egresado');
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
