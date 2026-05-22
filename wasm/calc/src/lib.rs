use calc::Context as CalcContext;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Context {
    inner: CalcContext,
}

#[wasm_bindgen]
impl Context {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Context {
        Context {
            inner: CalcContext::default(),
        }
    }

    pub fn evaluate(&mut self, expr: &str) -> String {
        match self.inner.evaluate_annotated(expr) {
            Ok(val) => val,
            Err(e) => format!("Error: {e}"),
        }
    }
}
