from openai import OpenAI
import os

# Inicializar el cliente de OpenAI
client = OpenAI(api_key='tu-clave-api-aquí')

def transcribir_audio(ruta_archivo):
    try:
        # Abre el archivo de audio
        with open(ruta_archivo, "rb") as archivo_audio:
            # Realiza la transcripción usando la API de Whisper
            transcripcion = client.audio.transcriptions.create(
                model="whisper-1",
                file=archivo_audio,
                language="es",  # Opcional: especifica el idioma
                response_format="text"  # Puedes usar "json", "text", "srt", "verbose_json", o "vtt"
            )
            
            # Retorna el texto transcrito
            return transcripcion
            
    except Exception as e:
        print(f"Error durante la transcripción: {str(e)}")
        return None

# Ejemplo de uso
if __name__ == "__main__":
    ruta_archivo = "ruta/a/tu/archivo/audio.mp3"  # Cambia esto a la ruta de tu archivo
    resultado = transcribir_audio(ruta_archivo)
    
    if resultado:
        print("Transcripción exitosa:")
        print(resultado)