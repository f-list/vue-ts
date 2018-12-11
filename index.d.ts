import Vue, {ComponentOptions, PropOptions, WatchOptions} from 'vue';
type Constructor<T> = Function & { prototype: T }
export declare function Component(options: ComponentOptions<Vue>): <V extends Constructor<Vue>>(target: V) => V;
export declare function Component<V extends Constructor<Vue>>(target: V): V;

declare const Prop: PropertyDecorator & ((options?: PropOptions) => PropertyDecorator);

export declare function Watch(expression: string, options?: WatchOptions): MethodDecorator;

export declare function Hook(name: 'beforeCreate' | 'created' | 'beforeMount' | 'mounted' | 'beforeDestroy' | 'destroyed' | 'beforeUpdate' | 'updated' | 'activated' | 'deactivated' | 'render' | 'errorCaptured'): MethodDecorator;

export {Prop}