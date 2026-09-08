package main

import (
	"flag"
	"log"
	"net/http"
)

func newHandler(webDir string) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet {
			writer.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		writer.Header().Set("Content-Type", "text/plain; charset=utf-8")
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write([]byte("ok"))
	})

	mux.HandleFunc("/", func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/" {
			http.NotFound(writer, request)
			return
		}
		if request.Method != http.MethodGet && request.Method != http.MethodHead {
			writer.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		http.ServeFile(writer, request, webDir+"/index.html")
	})

	staticHandler := http.FileServer(http.Dir(webDir + "/static"))
	mux.Handle("/static/", http.StripPrefix("/static/", staticHandler))

	return mux
}

func main() {
	address := flag.String("address", ":8080", "HTTP server listen address")
	flag.Parse()

	server := &http.Server{
		Addr:    *address,
		Handler: newHandler("web"),
	}

	log.Printf("Pomodoro server listening on %s", *address)
	log.Fatal(server.ListenAndServe())
}
