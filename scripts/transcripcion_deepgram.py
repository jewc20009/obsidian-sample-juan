from deepgram import DeepgramClient, PrerecordedOptions
import sys
import os
import json

# The API key we created in step 3
DEEPGRAM_API_KEY = '368032d8c053c174df815f0d4949e84e02a195b4'

def organizar_conversacion(palabras):
    # Agrupar palabras por hablante y tiempo
    conversacion = []
    mensaje_actual = {
        'hablante': None,
        'texto': [],
        'inicio': None,
        'fin': None
    }
    
    for palabra in palabras:
        if mensaje_actual['hablante'] != palabra['hablante'] or \
           (palabra['inicio'] - mensaje_actual['fin'] > 1.0 if mensaje_actual['fin'] else True):
            # Si cambia el hablante o hay una pausa mayor a 1 segundo
            if mensaje_actual['texto']:
                conversacion.append({
                    'hablante': mensaje_actual['hablante'],
                    'texto': ' '.join(mensaje_actual['texto']),
                    'inicio': mensaje_actual['inicio'],
                    'fin': mensaje_actual['fin']
                })
            mensaje_actual = {
                'hablante': palabra['hablante'],
                'texto': [palabra['palabra']],
                'inicio': palabra['inicio'],
                'fin': palabra['fin']
            }
        else:
            mensaje_actual['texto'].append(palabra['palabra'])
            mensaje_actual['fin'] = palabra['fin']
    
    # Añadir el último mensaje
    if mensaje_actual['texto']:
        conversacion.append({
            'hablante': mensaje_actual['hablante'],
            'texto': ' '.join(mensaje_actual['texto']),
            'inicio': mensaje_actual['inicio'],
            'fin': mensaje_actual['fin']
        })
    
    return conversacion

def formatear_conversacion(conversacion):
    texto_formateado = []
    
    for mensaje in conversacion:
        minutos = int(mensaje['inicio'] // 60)
        segundos = int(mensaje['inicio'] % 60)
        
        # Identificar hablante de forma más descriptiva
        hablante = "Martín" if mensaje['hablante'] == 0 else "Juan"
        
        # Formatear tiempo y mensaje
        tiempo = f"[{minutos:02d}:{segundos:02d}]"
        texto_formateado.append(f"{tiempo} **{hablante}**: {mensaje['texto']}")
    
    return "\n\n".join(texto_formateado)  # Doble salto de línea para mejor legibilidad

def transcribir_audio(ruta_archivo):
    try:
        # Inicializar el cliente de Deepgram
        deepgram = DeepgramClient(DEEPGRAM_API_KEY)

        # Abrir y transcribir el archivo
        with open(ruta_archivo, 'rb') as buffer_data:
            payload = { 'buffer': buffer_data }

            # Configurar más opciones
            options = PrerecordedOptions(
                model="nova-2",
                language="es",
                smart_format=True,
                punctuate=True,
                diarize=True,  # Identificación de hablantes
                summarize=True,  # Resumen
                detect_topics=True,  # Detección de temas
                detect_language=True,  # Detección de idioma
                paragraphs=True  # Separación en párrafos
            )

            print(f"Transcribiendo archivo: {ruta_archivo}")
            response = deepgram.listen.rest.v('1').transcribe_file(payload, options)
            
            # Extraer y organizar los datos
            result = response.results
            palabras = []
            
            if hasattr(result.channels[0].alternatives[0], 'words'):
                for word in result.channels[0].alternatives[0].words:
                    palabras.append({
                        'palabra': word.word,
                        'inicio': word.start,
                        'fin': word.end,
                        'hablante': word.speaker if hasattr(word, 'speaker') else 'desconocido'
                    })
            
            # Organizar la conversación
            conversacion = organizar_conversacion(palabras)
            
            # Crear el resultado final
            transcripcion_data = {
                'transcripcion': result.channels[0].alternatives[0].transcript,
                'idioma_detectado': result.channels[0].detected_language,
                'conversacion_formateada': formatear_conversacion(conversacion),
                'metadata': {
                    'duracion_total': float(conversacion[-1]['fin']) if conversacion else 0,
                    'num_hablantes': 2,  # En este caso sabemos que son 2
                    'archivo_original': os.path.basename(ruta_archivo)
                }
            }
            
            return json.dumps(transcripcion_data, ensure_ascii=False, indent=2)

    except Exception as e:
        print(f"Error durante la transcripción: {str(e)}")
        return None

def main():
    # Verificar argumentos de línea de comandos
    if len(sys.argv) != 2:
        print("Uso: python transcripcion_deepgram.py <ruta_archivo_wav>")
        sys.exit(1)

    # Obtener la ruta del archivo del argumento
    ruta_archivo = sys.argv[1]
    
    # Verificar que el archivo existe
    if not os.path.exists(ruta_archivo):
        print(f"No se encontró el archivo: {ruta_archivo}")
        sys.exit(1)

    # Realizar la transcripción
    resultado = transcribir_audio(ruta_archivo)
    
    if resultado:
        print(resultado)
    else:
        print("La transcripción falló")

if __name__ == '__main__':
    main()