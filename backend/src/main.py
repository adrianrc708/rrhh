from fastapi import FastAPI

app = FastAPI(title='SaaS HR API')

@app.get('/')
def read_root():
    return {'status': 'OK'}
