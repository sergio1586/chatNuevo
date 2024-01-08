const bodyParser = require('body-parser');
const express=require('express');
const fs=require('fs');
const app=express();
const server =require('http').Server(app);
const io=require('socket.io')(server);
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
app.post('/conectar',(req,res)=>{
    const username=req.body.username;
    if(username){
        const redirectUrl = `/chat?username=${encodeURIComponent(username)}`;
        res.redirect(redirectUrl);
    }else{
        res.send('Ponga nombre');
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
socket.on('mensajePublico',function(data){
    const nombre=data.nombre;
    const mensaje=data.mensaje;
    io.emit('mensajePublico',{nombre,mensaje});
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
        io.to(socketDestino.id).emit('privado',{emisor,mensaje:data.mensaje});
        io.to(idPersona).emit('privado',{emisor,mensaje:data.mensaje});
    }
});
socket.on('disconnect',function(){
    console.log('Usuario desconectado');
    delete usuarios[idPersona];//se borra la posicion del array cuando el usuario se va
    enviarListaUsuarios();//se actualiza la lista sin el usuario
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
server.listen(port, () => {
    console.log(`App escuchando en el puerto ${port}`);
    });