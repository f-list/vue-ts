import * as ts from 'typescript';

function getDecoratorName(decorator: ts.Decorator) {
    return decorator.expression.kind == ts.SyntaxKind.CallExpression ? (<ts.CallExpression>decorator.expression).expression.getText(decorator.getSourceFile()) : decorator.expression.getText(decorator.getSourceFile());
}

function getDecoratorArgument(decorator: ts.Decorator, index: number) {
    return decorator.expression.kind == ts.SyntaxKind.CallExpression ? (<ts.CallExpression>decorator.expression).arguments[index] : undefined;
}

function createProperty(object: ts.ObjectLiteralExpression, expr: ts.ObjectLiteralElementLike) {
    (<ts.ObjectLiteralElementLike[]><unknown>object.properties).push(expr);
}

function copyIfObject(object: ts.Node | undefined) {
    return ts.createObjectLiteral(object && object.kind == ts.SyntaxKind.ObjectLiteralExpression ? (<ts.ObjectLiteralExpression>object).properties : undefined);
}

const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const visitor: ts.Visitor = (node) => {
        const decorator = node.decorators && node.decorators.filter(x => getDecoratorName(x) === 'Component')[0];
        if(decorator) {
            const data = copyIfObject(getDecoratorArgument(decorator, 0));
            const computed: {[key: string]: {get?: ts.Block, set?: ts.Block}} = {}, watch: {[key: string]: ts.ObjectLiteralExpression[]} = {}, hooks: {[key: string]: ts.Expression[]} = {};
            const methods = ts.createObjectLiteral(), props = ts.createObjectLiteral();
            createProperty(data, ts.createPropertyAssignment('methods', methods));
            createProperty(data, ts.createPropertyAssignment('props', props));
            const dataObj = ts.createObjectLiteral();
            createProperty(data, ts.createMethod(undefined, undefined, undefined, 'data', undefined, undefined, [], undefined, ts.createBlock([ts.createReturn(dataObj)])));
            const cls = <ts.ClassDeclaration>node;
            for(const member of cls.members) {
                if(member.kind === ts.SyntaxKind.GetAccessor || member.kind === ts.SyntaxKind.SetAccessor) {
                    const accessor = <ts.AccessorDeclaration>member;
                    const entry = computed[accessor.name.getText()] || (computed[accessor.name.getText()] = {});
                    entry[member.kind === ts.SyntaxKind.GetAccessor ? 'get' : 'set'] = accessor.body;
                } else if(member.kind === ts.SyntaxKind.PropertyDeclaration) {
                    const property = <ts.PropertyDeclaration>member;
                    const prop = member.decorators && member.decorators.filter(x => getDecoratorName(x) === 'Prop')[0];
                    if(prop) {
                        const propData = copyIfObject(getDecoratorArgument(prop, 0));
                        //if(property.type)
                        //    createProperty(propData, ts.createPropertyAssignment('type', ts.createIdentifier(property.type.getText())));
                        createProperty(props, ts.createPropertyAssignment(property.name, propData));
                        continue;
                    }
                    if(property.name.getText().startsWith('$')) continue;
                    createProperty(dataObj, ts.createPropertyAssignment(property.name, (<ts.PropertyDeclaration>member).initializer || ts.createIdentifier('undefined')))
                } else if(member.kind === ts.SyntaxKind.MethodDeclaration) {
                    const method = <ts.MethodDeclaration>member;
                    createProperty(methods, method);
                    const hook = member.decorators && member.decorators.filter(x => getDecoratorName(x) === 'Hook')[0];
                    if(hook) {
                        const name = (<ts.StringLiteral>getDecoratorArgument(hook, 0)).text;
                        const entry = hooks[name] || (hooks[name] = []);
                        entry.push(method.name.kind === ts.SyntaxKind.StringLiteral || method.name.kind === ts.SyntaxKind.NumericLiteral ? method.name :
                            method.name.kind === ts.SyntaxKind.Identifier ? ts.createLiteral(method.name) : method.name.expression);
                    }
                    const watchDecorator = member.decorators && member.decorators.filter(x => getDecoratorName(x) === 'Watch')[0];
                    if(watchDecorator) {
                        const watchData = copyIfObject(getDecoratorArgument(watchDecorator, 1));
                        createProperty(watchData, ts.createPropertyAssignment(ts.createIdentifier('handler'), ts.createStringLiteral(method.name.getText())))
                        const name = (<ts.StringLiteral>getDecoratorArgument(watchDecorator, 0)).text;
                        const entry = watch[name] || (watch[name] = []);
                        entry.push(watchData);
                    }
                    method.decorators = undefined;
                }
            }

            function createIfAny<T>(entries: {[key: string]: T}, name: string, iterator: (key: string, value: T) => ts.Expression) {
                const keys = Object.keys(entries);
                if(!keys.length) return;
                createProperty(data, ts.createPropertyAssignment(name, ts.createObjectLiteral(keys.map(x => ts.createPropertyAssignment(ts.createStringLiteral(x), iterator(x, entries[x]))))));
            }
            createIfAny(computed, 'computed', (key, value) => {
                if(!value.get) throw new Error("No getter defined for " + key);
                const prop = ts.createObjectLiteral([ts.createMethod(undefined, undefined, undefined, 'get', undefined, undefined, [], undefined, value.get)]);
                if(value.set)
                    createProperty(prop, ts.createMethod(undefined, undefined, undefined, 'set', undefined, undefined, [], undefined, value.set))
                return prop;
            })
            createIfAny(watch, 'watch', (_, value) => ts.createArrayLiteral(value));
            for(const hook in hooks) {
                const block = ts.createBlock(hooks[hook].map(x => ts.createExpressionStatement(ts.createCall(ts.createElementAccess(ts.createThis(), x), undefined, undefined))))
                createProperty(data, ts.createMethod(undefined, undefined, undefined, hook, undefined, undefined, [], undefined, block));
            }

            const base = cls.heritageClauses!.filter(x => x.token == ts.SyntaxKind.ExtendsKeyword)[0].types[0];
            return ts.createExportDefault(ts.createCall(ts.createPropertyAccess(base.expression, ts.createIdentifier('extend')), undefined, [data]));
        }
        return node
    };

    return (node) => ts.visitEachChild(node, visitor, context);
};

export default transformer;