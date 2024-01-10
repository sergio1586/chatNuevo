// En tu archivo mongo.js
const mongoose = require('mongoose');
const mongoDBURI='mongodb+srv://sergioMedac:8248567@cluster0.mrajnew.mongodb.net/conversaciones';
const usuarioSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
});

const Usuario = mongoose.model('Usuario', usuarioSchema);

const conversacionSchema = new mongoose.Schema({
    usuarios: [{
        nombre: String,
        password: String,
    }],
    mensajes: [{
        contenido: String,
        fecha: Date,
    }],
});

const Conversacion = mongoose.model('Conversacion', conversacionSchema,'conversacion');

const conectarDB = async () => {
    try {
        await mongoose.connect(mongoDBURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        });
        console.log('Conectado a MongoDB Atlas');
    } catch (err) {
        console.error('Error al conectar a MongoDB', err);
        process.exit(1);
    }
};

module.exports = { conectarDB, Conversacion, Usuario };
