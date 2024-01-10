const bodyParser = require('body-parser');
const express=require('express');
const fs=require('fs');
const app=express();
const server =require('http').Server(app);
const io=require('socket.io')(server);
const path = require('path');

const {conectarDB,Conversacion,Usuario}=require('./mongo');
const PDFDocument = require('pdfkit');
const port=process.env.PORT || 3000;
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));



app.get('/',(req,res)=>{
    var contenido=fs.readFileSync('public/index.html');
    res.setHeader('Content-type','text/html');
    res.send(contenido);
});
app.get('/chat',(req,res)=>{
    const username=req.query.username;

    if(username){
        var contenido=fs.readFileSync('public/chat.html','utf8');
        contenido=contenido.replace('{{username}}',username);
        res.setHeader('Content-type','text/html');
        res.send(contenido);
    }else{
        res.send('Ponga nombre');
    }
})
app.post('/registro',async(req,res)=>{
    const {nombre,password}=req.body;

    try{
        //verifica si ya existe usuario
        const usuarioExistente = await Usuario.findOne({nombre}).exec();
        if(usuarioExistente){
            return res.status(400).json({mensaje:'El nombre de usuario ya existe'});
        }
        const nuevoUsuario= new Usuario({nombre,password});
        await nuevoUsuario.save();
        //res.status(201).json({mensaje:'Usuario registrado exitosamente'});

        res.redirect(`/`);
        
    }catch(error){
        console.error('Error al registrar usuario:',error);
        res.status(500).json({mensaje:'Error del servidor'});
    }
})
app.post('/conectar',async(req,res)=>{
    const {nombre,password}=req.body;
    try{
        //mira si el usuario para entrar
        const usuarioEncontrado=await Usuario.findOne({nombre,password}).exec();
        if(usuarioEncontrado){
            res.redirect(`/chat?username=${req.body.nombre}`);
        }else{
            return res.status(400).json({mensaje:'Usuario no registrado o contraseña erronea'});
        }
    }catch(error){
        console.error('Error al leer usuario:',error);
        res.status(500).json({mensaje:'Error del servidor'});
    }
})
const usuarios={};

io.on('connection',function(socket){
    console.log('Usuario conectado');

    const idPersona=socket.id;
    usuarios[idPersona]={
        socket:socket,
        username:null
    };

socket.on('usuarioElegido',function(data){
    usuarios[idPersona].username=data;
    enviarListaUsuarios();
});
socket.on('mensajePublico', async function (data) {
    const nombre = data.nombre;
    const mensaje = data.mensaje;
    try {
        let conversacion = await Conversacion.findOne().exec();
        if (!conversacion) {
            conversacion = new Conversacion({
                usuarios: [], // Cambiado a un array en lugar de objeto
                mensajes: []
            });
        }
        conversacion.usuarios.push({
            nombre: nombre
        });
        conversacion.mensajes.push({
            contenido: mensaje,
            fecha: new Date()
        });
        await conversacion.save();
        console.log('Mensaje guardado en Mongo', mensaje);
    } catch (error) {
        console.error('Error al guardar el mensaje', error);
    }
    io.emit('mensajePublico', { nombre, mensaje });
});

socket.on('privado',function(data){
    const usuarioElegido=data.usuarioElegido;
    let emisor=data.username;
    if(usuarioElegido && usuarios[usuarioElegido]){
        const socketDestino=usuarios[usuarioElegido].socket;
        /*
        estructura
            usuarios[idUsuario]={
                socket:socket{id},
                usuarioElegido:null
            };
            socket tiene un campo id que contiene la clave
        */
        if(socketDestino.id===idPersona){
            io.to(idPersona).emit('privado',{emisor,mensaje:'Te has mandado el mensaje a ti mismo, selecciona otro usuario'});
        }else{
            io.to(socketDestino.id).emit('privado',{emisor,mensaje:data.mensaje});
            io.to(idPersona).emit('privado',{emisor,mensaje:data.mensaje});
        }
        
    }
});
// En el servidor
app.get('/descargarPDF', (req, res) => {
    const filePath = path.join(__dirname, 'conversacion.pdf');
    res.download(filePath, 'conversacion.pdf', (err) => {
        if (err) {
            console.error('Error al descargar el archivo:', err);
            res.status(500).send('Error al descargar el archivo');
        }
    });
});

socket.on('descargarConversacion', async (data) => {
    try {
        const conversacion = await Conversacion.find().lean();

        const pdfStream = fs.createWriteStream('conversacion.pdf');
        const docPdf = new PDFDocument();
        docPdf.pipe(pdfStream);

        for (const conversacionItem of conversacion) {
            const usuarios = conversacionItem.usuarios || [];
            const mensajes = conversacionItem.mensajes || [];

            // Asumiendo que hay tantos usuarios como mensajes
            for (let i = 0; i < mensajes.length; i++) {
                const usuario = usuarios[i] || {};
                const mensaje = mensajes[i] || {};

                const nombreUsuario = usuario.nombre || 'Sin nombre';
                const contenidoMensaje = mensaje.contenido || 'Mensaje Vacío';
                const fechaMensaje = mensaje.fecha || 'Fecha vacía';

                const mensajeTexto = `${nombreUsuario}: ${contenidoMensaje}, ${fechaMensaje} \n`;
                docPdf.text(mensajeTexto);
            }
        }

        docPdf.end();
        console.log('Conversacion guardada en PDF');
        socket.emit('descarga', { url: '/descargarPDF' }); // Envía la URL al cliente
    } catch (error) {
        console.error('Error al descargar PDF', error);
    }
});




socket.on('disconnect',function(){
    console.log('Usuario desconectado');
    delete usuarios[idPersona];//se borra la posicion del array cuando el usuario se va
    enviarListaUsuarios();//se actualiza la lista sin el usuario
    if(Object.keys(usuarios).length===0){
        borrarConversacionMongo();
    }
});


function enviarListaUsuarios() {
    // Object.keys(usuarios): Obtiene un array con las claves del objeto 'usuarios'
    const listaUsuarios = Object.keys(usuarios).map(id => {
        // Por cada clave (id) en el array, crea un nuevo objeto con las siguientes propiedades:
        return {
            // 'idUsuario': la clave (id) actual en el array
            idPersona: id,
            // 'nombreUsuario': el valor de 'usuarioElegido' asociado a esa clave (id) en el objeto 'usuarios'
            nombreUsuario: usuarios[id].username
        };
    });
        //envia la lista estructurada al cliente
    io.emit('listaUsuarios', listaUsuarios);
}


});
conectarDB();
async function borrarConversacionMongo() {
    try {
        // Elimina todas las conversaciones
        await Conversacion.deleteMany();
        console.log('Conversación eliminada de MongoDB');
    } catch (error) {
        console.error('Error al eliminar conversación de MongoDB', error);
    }
}
server.listen(port, () => {
    console.log(`App escuchando en el puerto ${port}`);
    });