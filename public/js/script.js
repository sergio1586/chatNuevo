$(document).ready(() => {
    const socket = io();/*funcion especifica de la bliblioteca socker.io 
    que crea una isntancia de conexion con el servidor.
    servidor y cliente usan mismo dominio y puerto*/
    let username=obtenerNombreURL('username');//va a llevar el nombre del usuario
    
        if(username){
            socket.emit('usuarioElegido',username);/*emite el evento con el usuario y 
            lo asocia al campo de usuarioElegido de la coleccion de datos*/
            //Con lo de abajo creo un h2 y pongo el nombre de quien es el usuario de ese chat
            $('#usuarioSelecionado').prop('disabled',false);//ya no esta desactivado
            var nombreChat= $('<h2></h2>');
            nombreChat.text(`${username.toUpperCase()}`);
            $('#main').prepend(nombreChat);//añade el elemento al principio
        }

    socket.on('listaUsuarios', function (usuarios) {
        $('#listaUsuarios').empty();//elimina lo anterior del DOM antes de añadir
        usuarios.forEach(usuario => {//recorre toda la coleccion y agrega a ala lista el nombre
            $('#listaUsuarios').append(`<p>${usuario.nombreUsuario}</p>`).addClass('display-6');
        });
    
        $('#usuarioSelecionado').empty();
        usuarios.forEach(usuario => {//y a la lista desplegable el nombre pero el value es el id
            $('#usuarioSelecionado').append(`<option value="${usuario.idPersona}">${usuario.nombreUsuario}</option>`);
        });
    });

//se lanza cuando el evento es publico recibe el emit del servidor
    socket.on('mensajePublico',function(data){
        if(contienePalabra(data.mensaje,palabrasProhibidas)){//si el mensaje contiene algun insulto se mete en esta if
            var mensajebloqueo = $("<p><strong>Mensaje bloqueado por inclumplir normas</strong></p>");
            mensajebloqueo.css('color','red');
            $('#mensajes').append(mensajebloqueo);
            scrool();

        }else{//si las palabras no son bloqueadas muestra el mensaje publico inidcando el nombre
            $('#mensajes').append(`<p><strong>${data.nombre}:</strong> ${data.mensaje}</p>`);
            scrool();
        }
        
        mostrarEtiqueta();
        
    });
//recibe el emit del servidor cuando es privado pone el nombre del remite y el mensaje en el DOM
    socket.on('privado', function (data) {
        if(contienePalabra(data.mensaje,palabrasProhibidas)){//si el mensaje contiene algun insulto se mete en esta if
            var mensajebloqueo = $("<p><strong>Mensaje bloqueado por inclumplir normas</strong></p>");
            mensajebloqueo.css('color','red');
            $('#mensajes').append(mensajebloqueo);
            scrool();
        }else{//si las palabras no son bloqueadas muestra el mensaje publico inidcando el nombre
            var privado=$(`<p><strong>Privado (${data.emisor}):</strong> ${data.mensaje}</p>`);//guardo en una variable y le aplico css
            privado.css({
                'background-color':'#669900',
                'color':'#FFFFFF',
                'padding':'5px'
            });
            $('#mensajes').append(privado);//añado a mensajes
            scrool();
        } 
    });
//la funcion se lanza con el boton que lo llama desde el html
    window.enviarPublico=()=>{
        const mensaje=$('#inputMensaje').val();//coge el valor del input
        const nombre=username;//coge el nombre de quien lo manda
        socket.emit('mensajePublico',{mensaje,nombre});//emite el mensaje publico
        $('#inputMensaje').val('');//limpia el inputMensaje
        

    };
//se lanza con el boton privado
    window.enviarPrivado = () => {
        //const emisor=username;
        const mensaje = $('#inputMensaje').val();//coge el mensaje
        const usuarioElegido = $('#usuarioSelecionado').val();//coge el value del select
        socket.emit('privado', { username, mensaje, usuarioElegido });//envia lo anterio como evento privado al servidor
        $('#inputMensaje').val('');
    };
    //para que cuando se pulse enter se mande publico
    $('#inputMensaje').on('keyup', function(event) {
        if (event.key === 'Enter'&& !event.shiftKey) {
            // Si la tecla es solo "Enter", llamar a la función enviarPublico
            enviarPublico();
            event.preventDefault();
        }else if(event.key === 'Enter'&& event.shiftKey){// si la tecla es una convinacion de de Enter+shift se manda privado
            enviarPrivado();
            event.preventDefault();
        }
    });
    // En el cliente
socket.on('descarga', function(data) {
    const { url } = data;//recoge la url que estara en /descargaPDF
    const link = document.createElement('a');
    link.href = url;
    link.download = 'conversacion.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Función en el cliente para iniciar la descarga desde la interfaz
window.descargar = () => {
    socket.emit('descargarConversacion', { username });
};

    //funcion que comprueba si una palabra esta en uns cadena
    function contienePalabra(cadena, palabras) {
        var cadenaMinus=cadena.toLowerCase();//ponemos la cadena a minuscula todo
        return palabras.some(palabra => cadenaMinus.includes(palabra));//observa si la cadena incluye alguna de las palabras
    }
    //el array que con el que comparo el mensaje
    const palabrasProhibidas = [
        'gilipollas',
        'tonto',
        'cabron',
        'idiota',
        'imbecil',
        'estupido',
        'subnormal',
        'puta',
        'mierda',
        'coño',
        'joder',
        'pendejo',
        'pendeja',
        'puto',
        'puta',
        'malparido',
        'malparida',
        'hijo de puta',
        'hija de puta',
        'chinga tu madre',
        'mamón',
        'mamona',
        'baboso',
        'babosa',
        'maricón',
        'marica',
        'capullo',
        'estupido'
        // Agrega más palabras según tus necesidades
    ];
    function obtenerNombreURL(nombre){
        const urlParams=new URLSearchParams(window.location.search);
        return urlParams.get(nombre);
    }
    function saberNumeroHijos(etiqueta) {
        let numeroHijos = etiqueta.children('p').length;//con esto averiguamos el numero de p de la etiqueta
        return numeroHijos;
    }
    function mostrarEtiqueta() {
        const divMensajes = $('#mensajes');
        const botonDescargar = $('#descargar');
    
        if (saberNumeroHijos(divMensajes) !== 0) {//en cuanto se agrege un elemento p se llama a la funcion
            botonDescargar.prop('hidden',false);
        } else {
            console.log('Ocultando botón de descarga');
            
        }
    }
    //mantiene en vision el ultimo mensaje mandado
    function scrool(){
        $('#mensajes').scrollTop($('#mensajes')[0].scrollHeight);
    }
});