const bodyParser = require('body-parser');
const express=require('express');
const fs=require('fs');
const app=express();
const server =require('http').Server(app);
const io=require('socket.io')(server);
const path = require('path');//sirve para el pdf

const {conectarDB,Conversacion,Usuario}=require('./mongo');
const PDFDocument = require('pdfkit');//generador de pdf
const port=process.env.PORT || 3000;
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));



app.get('/',(req,res)=>{//devuelve el index
    var contenido=fs.readFileSync('public/index.html');
    res.setHeader('Content-type','text/html');
    res.send(contenido);
});
app.get('/irRegistro',(req,res)=>{
    var contenido=fs.readFileSync('public/registro.html');
    res.setHeader('Content-type','text/html');
    res.send(contenido);
})
app.get('/chat',(req,res)=>{//cuando /conectar comprueba que existe el usuario llama a esta
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
            //return res.status(400).json({mensaje:'El nombre de usuario ya existe'});
            const mensajeError='Nombre de usuario ya registrado';
            const script =`<script>alert('${mensajeError}');window.location.href='/irRegistro';</script>`;//enseña el error
            return res.send(script);
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
app.post('/conectar',async(req,res)=>{//esta peticion la llama en html
    const {nombre,password}=req.body;
    try{
        //mira si el usuario para entrar
        const usuarioEncontrado=await Usuario.findOne({nombre,password}).exec();
        if(usuarioEncontrado){
            res.redirect(`/chat?username=${req.body.nombre}`);//manda a /chat con el nombre de usuario
        }else{
            const mensajeError='Usuario no registrado o contraseña incorrecta';
            const script =`<script>alert('${mensajeError}');window.location.href='/';</script>`;//enseña el error
            res.send(script);
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

socket.on('usuarioElegido',function(data){//esto escucha el emit del cliente y manda los usuarios conectado
    usuarios[idPersona].username=data;
    enviarListaUsuarios();
});
socket.on('mensajePublico', async function (data) {
    const nombre = data.nombre;
    const mensaje = data.mensaje;
    try {
        let conversacion = await Conversacion.findOne().exec();
        if (!conversacion) {//si la conversacion no existe, crea la conversacion
            conversacion = new Conversacion({
                usuarios: [],
                mensajes: []
            });
        }
        conversacion.usuarios.push({//añade a la tabla usuario el nombre del usuario que manda el mensaje
            nombre: nombre
        });
        conversacion.mensajes.push({//añade a la tabla mensajes el mensaje y la fecha
            contenido: mensaje,
            fecha: new Date()
        });
        await conversacion.save();//guarda la cnversacion
        console.log('Mensaje guardado en Mongo', mensaje);
    } catch (error) {
        console.error('Error al guardar el mensaje', error);
    }
    io.emit('mensajePublico', { nombre, mensaje });//emite el mensaje con el usuario que la manda
});

socket.on('privado',function(data){
    const usuarioElegido=data.usuarioElegido;//quien recibe el mensaje
    let emisor=data.username;//cogemos quien envia el mensaje
    if(usuarioElegido && usuarios[usuarioElegido]){//si el primero tiene datos y existe el array general 
        const socketDestino=usuarios[usuarioElegido].socket;//este es el autentico que lo recibe
        /*
        estructura
            usuarios[idUsuario]={
                socket:socket{id},
                usuarioElegido:null
            };
            socket tiene un campo id que contiene la clave
        */
        if(socketDestino.id===idPersona){//si el destino y quien lo manda es el mismo
            io.to(idPersona).emit('privado',{emisor,mensaje:'Te has mandado el mensaje a ti mismo, selecciona otro usuario'});
        }else{//si es distinto entra aqui
            io.to(socketDestino.id).emit('privado',{emisor,mensaje:data.mensaje});
            io.to(idPersona).emit('privado',{emisor,mensaje:data.mensaje});
        }
        
    }
});
//esta funcion la llama el cliente que recibe la url mediante el evento descargarConversacion
app.get('/descargarPDF', (req, res) => {
    const filePath = path.join(__dirname, 'conversacion.pdf');
    res.download(filePath, 'conversacion.pdf', (err) => {//responde con el enlace de descarga
        if (err) {
            console.error('Error al descargar el archivo:', err);
            res.status(500).send('Error al descargar el archivo');
        }
    });
});

socket.on('descargarConversacion', async (data) => {
    try {
        const conversacion = await Conversacion.find().lean();//mira si existe una conversacion

        const pdfStream = fs.createWriteStream('conversacion.pdf');
        const docPdf = new PDFDocument();
        docPdf.pipe(pdfStream);

        for (const conversacionItem of conversacion) {//desglosamos la conversacion en subtablas
            const usuarios = conversacionItem.usuarios || [];
            const mensajes = conversacionItem.mensajes || [];

            // Asumiendo que hay tantos usuarios como mensajes y que cada vez que se manda se sabe quien lo hace agrupamos por posicion
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
        socket.emit('descarga', { url: '/descargarPDF' }); // Envía la URL al cliente de el pdf
    } catch (error) {
        console.error('Error al descargar PDF', error);
    }
});




socket.on('disconnect',function(){
    console.log('Usuario desconectado');
    delete usuarios[idPersona];//se borra la posicion del array cuando el usuario se va
    enviarListaUsuarios();//se actualiza la lista sin el usuario
    if(Object.keys(usuarios).length===0){//cuando no hay usuarios conectados borra la conversacion de mongo
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