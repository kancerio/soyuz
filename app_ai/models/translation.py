from transformers import MarianMTModel, MarianTokenizer

_model = None
_tokenizer = None

def load_translation_model(src_lang="en", tgt_lang="ru"):
    global _model, _tokenizer
    model_name = f"Helsinki-NLP/opus-mt-{src_lang}-{tgt_lang}"
    _tokenizer = MarianTokenizer.from_pretrained(model_name)
    _model = MarianMTModel.from_pretrained(model_name)
    return _model, _tokenizer

def get_translation_model():
    global _model, _tokenizer
    if _model is None:
        load_translation_model()
    return _model, _tokenizer