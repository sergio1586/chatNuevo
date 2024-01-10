$(document).ready(()=>{
    
    // Usar jQuery para manejar el evento de tecla "Enter"
    $("#username").on("keyup", function(event) {
        // Verificar si la tecla presionada es "Enter" (código 13)
        if (event.keyCode === 13) {
            // Cancelar el comportamiento predeterminado del formulario
            event.preventDefault();
            // Activar el botón de conexión
            $("#conectarBtn").click();
        }
    });
})